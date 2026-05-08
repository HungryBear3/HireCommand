import type { Express } from "express";
import { db } from "./storage";
import { candidates, jobs } from "@shared/schema";
import { callClaude, parseJSON } from "./ai";

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
let isRunning = false;

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
    });
  });

  app.get("/api/rediscovery/results", (_req, res) => {
    res.json(latestResults);
  });

  app.post("/api/rediscovery/run", async (req, res) => {
    if (isRunning) return res.status(409).json({ error: "Analysis already running" });

    isRunning = true;
    res.json({ message: "Rediscovery analysis started" });

    runAnalysis()
      .then((results) => { latestResults = results; })
      .catch((e) => { console.error("[rediscovery] Error:", e.message); })
      .finally(() => { isRunning = false; });
  });
}
