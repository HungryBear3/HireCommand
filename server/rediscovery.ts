import type { Express } from "express";
import { db } from "./storage";
import { eq } from "drizzle-orm";
import { candidateJobAssignments, candidates, jobs } from "@shared/schema";
import { callClaude, hasAnthropicApiKey, parseJSON } from "./ai";

export interface JobMatch {
  candidateId: number;
  candidateName: string;
  candidateTitle: string;
  candidateCompany: string;
  candidateEmail: string;
  jobId: number;
  jobTitle: string;
  jobCompany: string;
  fitScore: number;
  fitReason: string;
  suggestedAction: string;
}

export interface ChangeCandidate {
  candidateId: number;
  candidateName: string;
  candidateTitle: string;
  candidateCompany: string;
  candidateEmail: string;
  tenure: string;
  changeSignals: string[];
  changeScore: number;
  brief: string;
}

export interface BDTarget {
  company: string;
  contactName: string;
  contactTitle: string;
  contactEmail: string;
  candidateCount: number;
  insight: string;
  bdScore: number;
}

export interface RediscoveryResult {
  jobMatches: JobMatch[];
  openToChange: ChangeCandidate[];
  bdTargets: BDTarget[];
  generatedAt: string;
  candidatesAnalyzed: number;
}

let latestResults: RediscoveryResult | null = null;
let latestError: string | null = null;
let isRunning = false;

function parseRequirements(requirements: string | null | undefined): string[] {
  try {
    const parsed = JSON.parse(requirements || "[]");
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function parseTags(tags: string | null | undefined): string[] {
  try {
    const parsed = JSON.parse(tags || "[]");
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

const STOP_WORDS = new Set([
  "and", "the", "for", "with", "from", "that", "this", "role", "job", "years", "year",
  "experience", "executive", "leader", "leadership", "senior", "candidate", "company",
]);

function tokens(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9+#.\s-]/g, " ")
      .split(/\s+/)
      .map((t) => t.trim())
      .filter((t) => t.length > 2 && !STOP_WORDS.has(t)),
  );
}

function heuristicMatchScore(candidate: typeof candidates.$inferSelect, job: typeof jobs.$inferSelect) {
  const reqs = parseRequirements(job.requirements);
  const candidateTags = parseTags(candidate.tags);
  const jobText = [job.title, job.company, job.location, job.description, ...reqs].join(" ");
  const candidateText = [candidate.name, candidate.title, candidate.company, candidate.location, candidate.status, candidate.notes, ...candidateTags].join(" ");
  const jobTokens = tokens(jobText);
  const candidateTokens = tokens(candidateText);
  let overlap = 0;
  for (const token of jobTokens) if (candidateTokens.has(token)) overlap++;

  const titleWords = tokens(job.title);
  let titleOverlap = 0;
  for (const token of titleWords) if (candidateTokens.has(token)) titleOverlap++;

  const locationBonus = job.location && candidate.location && candidate.location.toLowerCase().includes(job.location.split(",")[0].toLowerCase()) ? 6 : 0;
  const statusBonus = ["sourced", "contacted", "screening"].includes(candidate.status) ? 5 : 0;
  const score = Math.min(98, Math.round(52 + overlap * 5 + titleOverlap * 9 + locationBonus + statusBonus));

  return {
    score,
    reason: titleOverlap > 0
      ? `${candidate.name}'s ${candidate.title} background lines up with the ${job.title} search${overlap > 0 ? `, including ${overlap} keyword/requirement match${overlap === 1 ? "" : "es"}` : ""}.`
      : `${candidate.name} has adjacent experience worth reviewing for the ${job.title} search${overlap > 0 ? ` with ${overlap} matching signal${overlap === 1 ? "" : "s"}` : ""}.`,
  };
}

function heuristicMatchesForJob(job: typeof jobs.$inferSelect, allCandidates: Array<typeof candidates.$inferSelect>, max = 10): JobMatch[] {
  return allCandidates
    .map((candidate) => {
      const scored = heuristicMatchScore(candidate, job);
      return {
        candidateId: candidate.id,
        candidateName: candidate.name,
        candidateTitle: candidate.title,
        candidateCompany: candidate.company,
        candidateEmail: candidate.email,
        jobId: job.id,
        jobTitle: job.title,
        jobCompany: job.company,
        fitScore: scored.score,
        fitReason: scored.reason,
        suggestedAction: `Review profile and start outreach for ${job.title}.`,
      } as JobMatch;
    })
    .filter((match) => match.fitScore >= 70)
    .sort((a, b) => b.fitScore - a.fitScore)
    .slice(0, max);
}

export async function sourceCandidatesForJob(job: typeof jobs.$inferSelect, max = 10): Promise<JobMatch[]> {
  if (job.stage === "closed") return [];
  const allCandidates = await db.select().from(candidates);
  if (allCandidates.length === 0) return [];

  const fallbackMatches = heuristicMatchesForJob(job, allCandidates, max);
  let matches = fallbackMatches;

  if (hasAnthropicApiKey()) {
    try {
      const reqs = parseRequirements(job.requirements).join(", ");
      const shortlist = fallbackMatches.length > 0
        ? allCandidates.filter((c) => fallbackMatches.some((m) => m.candidateId === c.id))
        : allCandidates.slice(0, 60);
      const candidateList = shortlist.slice(0, 60).map((c) => {
        const tags = parseTags(c.tags).join(", ");
        return `ID:${c.id}|${c.name}|${c.title}|${c.company}|${c.location}|${c.status}|email:${c.email}|tags:${tags}|notes:${(c.notes || "").slice(0, 240)}`;
      }).join("\n");
      const prompt = `Match candidates from the CRM to this newly added job. Return only JSON, no markdown.

JOB:
ID:${job.id}|${job.title}|${job.company}|${job.location}|stage:${job.stage}|requirements:${reqs}|description:${job.description}

CANDIDATES:
${candidateList}

Return exactly:
{"matches":[{"candidateId":number,"fitScore":70-100,"fitReason":"1 sentence reason","suggestedAction":"specific next step"}]}

Rules: max ${max}; only fitScore >= 70; sort best first; do not invent candidate IDs.`;
      const raw = await callClaude(prompt, "You are an elite executive recruiter matching database candidates to an open search. Return only valid JSON.", 2048);
      const parsed = parseJSON<{ matches?: Array<{ candidateId: number; fitScore: number; fitReason: string; suggestedAction: string }> }>(raw);
      const byId = new Map(allCandidates.map((c) => [c.id, c]));
      const aiMatches = (parsed.matches || [])
        .map((m) => {
          const candidate = byId.get(Number(m.candidateId));
          if (!candidate) return null;
          return {
            candidateId: candidate.id,
            candidateName: candidate.name,
            candidateTitle: candidate.title,
            candidateCompany: candidate.company,
            candidateEmail: candidate.email,
            jobId: job.id,
            jobTitle: job.title,
            jobCompany: job.company,
            fitScore: Math.max(70, Math.min(100, Math.round(Number(m.fitScore) || 70))),
            fitReason: m.fitReason || heuristicMatchScore(candidate, job).reason,
            suggestedAction: m.suggestedAction || `Review profile and start outreach for ${job.title}.`,
          } as JobMatch;
        })
        .filter((m): m is JobMatch => !!m)
        .sort((a, b) => b.fitScore - a.fitScore)
        .slice(0, max);
      if (aiMatches.length > 0) matches = aiMatches;
    } catch (e: any) {
      console.error("[job-matching] Claude match failed; using heuristic fallback:", e.message);
    }
  }

  for (const match of matches) {
    await db.insert(candidateJobAssignments).values({
      candidateId: match.candidateId,
      jobId: job.id,
      status: "sourced",
      notes: `AI match ${match.fitScore}: ${match.fitReason}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }).onConflictDoNothing();
  }
  await db.update(jobs).set({ candidateCount: matches.length }).where(eq(jobs.id, job.id));
  return matches;
}

async function runAnalysis() {
  const [allCandidates, openJobs] = await Promise.all([
    db.select().from(candidates),
    db.select().from(jobs),
  ]);

  if (allCandidates.length === 0) {
    return {
      jobMatches: [], openToChange: [], bdTargets: [],
      generatedAt: new Date().toISOString(), candidatesAnalyzed: 0,
    } as RediscoveryResult;
  }

  // Sample up to 60 candidates to keep the prompt manageable
  const sample = allCandidates.slice(0, 60);

  const candidateList = sample.map(c => {
    const tags = (() => { try { return JSON.parse(c.tags || "[]").join(", "); } catch { return ""; } })();
    return `ID:${c.id}|${c.name}|${c.title}|${c.company}|${c.location}|${c.status}|last_contact:${c.lastContact}|email:${c.email}|tags:${tags}`;
  }).join("\n");

  const jobList = openJobs.slice(0, 25).map(j => {
    const reqs = (() => { try { return JSON.parse(j.requirements || "[]").slice(0, 3).join(", "); } catch { return ""; } })();
    return `ID:${j.id}|${j.title}|${j.company}|${j.location}|stage:${j.stage}|reqs:${reqs}`;
  }).join("\n") || "No open jobs";

  const today = new Date().toISOString().split("T")[0];

  const prompt = `You are analyzing ${sample.length} executive candidates in a recruiting CRM for rediscovery opportunities. Today is ${today}.

CANDIDATES (pipe-delimited: ID|name|title|company|location|status|last_contact|email|tags):
${candidateList}

OPEN JOBS (pipe-delimited: ID|title|company|location|stage|requirements):
${jobList}

Analyze and return JSON with exactly this structure (no markdown, no comments):
{
  "jobMatches": [
    {
      "candidateId": <number>,
      "candidateName": "<string>",
      "candidateTitle": "<string>",
      "candidateCompany": "<string>",
      "candidateEmail": "<string>",
      "jobId": <number>,
      "jobTitle": "<string>",
      "jobCompany": "<string>",
      "fitScore": <70-100>,
      "fitReason": "<1-2 sentences: why this candidate fits this specific role>",
      "suggestedAction": "<specific next step, e.g. 'Schedule intro call — last contacted 90 days ago'>"
    }
  ],
  "openToChange": [
    {
      "candidateId": <number>,
      "candidateName": "<string>",
      "candidateTitle": "<string>",
      "candidateCompany": "<string>",
      "candidateEmail": "<string>",
      "tenure": "<estimate based on available data, e.g. '2+ years' or 'Unknown'>",
      "changeSignals": ["<signal like 'Stale contact — 120 days'>", "<signal like 'Senior IC, may seek leadership'>"],
      "changeScore": <0-100>,
      "brief": "<2-3 sentences: why reach out now and what angle to use>"
    }
  ],
  "bdTargets": [
    {
      "company": "<company name>",
      "contactName": "<most senior person from this company in the DB>",
      "contactTitle": "<their title>",
      "contactEmail": "<their email>",
      "candidateCount": <number>,
      "insight": "<why this company is a good BD target — growth signals, hiring patterns, industry>",
      "bdScore": <0-100>
    }
  ]
}

Selection rules:
- jobMatches: fitScore >= 70 only, max 12, sorted desc by fitScore
- openToChange: prioritize status='sourced' or 'contacted', last_contact > 45 days ago, or candidates showing career inflection signals. Max 12, sorted desc by changeScore
- bdTargets: companies with 2+ candidates, or where candidates have impressive recent progression suggesting the company is growing. Max 8, sorted desc by bdScore
- If no good matches exist for a category, return empty array []`;

  const raw = await callClaude(prompt,
    "You are an elite executive recruiting intelligence system. Return only valid JSON, no commentary.",
    4096,
  );

  const parsed = parseJSON<{ jobMatches: JobMatch[]; openToChange: ChangeCandidate[]; bdTargets: BDTarget[] }>(raw);

  return {
    jobMatches: (parsed.jobMatches || []).slice(0, 12),
    openToChange: (parsed.openToChange || []).slice(0, 12),
    bdTargets: (parsed.bdTargets || []).slice(0, 8),
    generatedAt: new Date().toISOString(),
    candidatesAnalyzed: sample.length,
  } as RediscoveryResult;
}

export function registerRediscoveryRoutes(app: Express) {
  app.get("/api/rediscovery/status", (_req, res) => {
    res.json({
      isRunning,
      hasResults: !!latestResults,
      generatedAt: latestResults?.generatedAt ?? null,
      candidatesAnalyzed: latestResults?.candidatesAnalyzed ?? 0,
      error: latestError,
      hasAnthropicApiKey: hasAnthropicApiKey(),
    });
  });

  app.get("/api/rediscovery/results", (_req, res) => {
    res.json(latestResults);
  });

  app.post("/api/rediscovery/run", async (_req, res) => {
    if (isRunning) return res.status(409).json({ error: "Analysis already running" });

    isRunning = true;
    latestError = null;

    try {
      const results = await runAnalysis();
      latestResults = results;
      res.json({ message: "Rediscovery analysis complete", results });
    } catch (e: any) {
      latestError = e.message || "Rediscovery analysis failed";
      console.error("[rediscovery] Error:", latestError);
      res.status(500).json({ error: latestError });
    } finally {
      isRunning = false;
    }
  });
}
