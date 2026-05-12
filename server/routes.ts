import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertCandidateSchema, insertJobSchema, insertActivitySchema, insertInterviewSchema, insertOpportunitySchema, insertCampaignSchema } from "@shared/schema";
import { registerOpenApi } from "./openapi";
import { registerSourcingRoutes } from "./sourcing";
import { calculateCandidateMatchScore } from "./match-score";
import { registerQBRoutes } from "./quickbooks";
import { registerLinkedInSyncRoutes, checkAndRunStartupSync } from "./linkedin-sync";
import { registerCandidateImportRoutes } from "./candidate-import";
import { registerSchedulingRoutes } from "./scheduling";
import { registerRediscoveryRoutes, sourceCandidatesForJob } from "./rediscovery";
import { callClaude } from "./ai";
import { insertInvoiceSchema } from "@shared/schema";
import passport from "passport";
import { requireAuth, requireAdmin, hashPassword } from "./auth";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // ======================== HEALTH CHECK ========================
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // ======================== AUTH ========================

  app.post("/api/login", (req, res, next) => {
    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) return next(err);
      if (!user) return res.status(401).json({ error: info?.message || "Invalid credentials" });
      req.logIn(user, (err2) => {
        if (err2) return next(err2);
        const { password: _pw, ...safe } = user;
        res.json(safe);
      });
    })(req, res, next);
  });

  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.json({ ok: true });
    });
  });

  app.get("/api/me", (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ error: "Unauthorized" });
    const { password: _pw, ...safe } = req.user as any;
    res.json(safe);
  });

  // Admin: list all users
  app.get("/api/users", requireAdmin, async (_req, res) => {
    // Don't expose passwords
    const allUsers = await storage.getAllUsers();
    res.json(allUsers.map(({ password: _pw, ...u }) => u));
  });

  // Admin: create user
  app.post("/api/users", requireAdmin, async (req, res) => {
    const { email, username, password, role, recruiterName } = req.body;
    if (!email || !password) return res.status(400).json({ error: "email and password required" });
    const hashed = await hashPassword(password);
    const user = await storage.createUser({
      email,
      username: username || email,
      password: hashed,
      role: role || "user",
      recruiterName: recruiterName || null,
    });
    const { password: _pw, ...safe } = user;
    res.status(201).json(safe);
  });

  // Admin: update user
  app.patch("/api/users/:id", requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    const { password, ...rest } = req.body;
    const update: Record<string, unknown> = { ...rest };
    if (password) update.password = await hashPassword(password);
    const user = await storage.updateUser(id, update as any);
    if (!user) return res.status(404).json({ error: "Not found" });
    const { password: _pw, ...safe } = user;
    res.json(safe);
  });

  // Self: change own password
  app.post("/api/me/change-password", requireAuth, async (req, res) => {
    const me = req.user as any;
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ error: "Missing fields" });
    const bcrypt = await import("bcrypt");
    const ok = await bcrypt.compare(currentPassword, me.password);
    if (!ok) return res.status(401).json({ error: "Current password incorrect" });
    await storage.updateUser(me.id, { password: await hashPassword(newPassword) });
    res.json({ ok: true });
  });

  // ======================== AUTH WALL ========================
  // All routes below this line require a valid session.
  // /api/health, /api/login, /api/logout, /api/me are registered above and
  // handled before this middleware fires for those paths.
  app.use("/api", requireAuth);

  // ======================== AI ASSISTANT ========================
  app.post("/api/ai-assistant", async (req, res) => {
    try {
      const query = String(req.body?.message || "").trim();
      if (!query) return res.status(400).json({ error: "Message is required" });

      const [allCandidates, allJobs, allActivities, allInterviews, allPlacements, allCompanies, allClients] = await Promise.all([
        storage.getCandidates(),
        storage.getJobs(),
        storage.getActivities(),
        storage.getInterviews(),
        storage.getPlacements(),
        storage.getLoxoCompanies(),
        storage.getLoxoClients(),
      ]);

      const terms = query.toLowerCase().split(/[^a-z0-9@.]+/).filter((term) => term.length > 2);
      const scoreText = (value: string) => terms.reduce((score, term) => score + (value.toLowerCase().includes(term) ? 1 : 0), 0);
      const parseJsonArray = (raw: string) => {
        try {
          const parsed = JSON.parse(raw || "[]");
          return Array.isArray(parsed) ? parsed : [];
        } catch {
          return raw ? raw.split(",").map((item) => item.trim()).filter(Boolean) : [];
        }
      };

      const candidateMatches = allCandidates
        .map((candidate) => ({
          candidate,
          score: scoreText([
            candidate.name,
            candidate.title,
            candidate.company,
            candidate.location,
            candidate.status,
            candidate.notes,
            parseJsonArray(candidate.tags).join(" "),
          ].join(" ")) + (candidate.matchScore || 0) / 100,
        }))
        .filter((item) => item.score > 0 || terms.length === 0)
        .sort((a, b) => b.score - a.score || (b.candidate.matchScore || 0) - (a.candidate.matchScore || 0))
        .slice(0, 8)
        .map(({ candidate }) => candidate);

      const jobMatches = allJobs
        .map((job) => ({ job, score: scoreText([job.title, job.company, job.location, job.stage, job.description, job.requirements].join(" ")) }))
        .filter((item) => item.score > 0 || terms.length === 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 6)
        .map(({ job }) => job);

      const clientMatches = allClients
        .map((client) => ({ client, score: scoreText([client.name, client.company, client.title, client.location, client.email].join(" ")) }))
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 6)
        .map(({ client }) => client);

      const snapshot = {
        totals: {
          candidates: allCandidates.length,
          jobs: allJobs.length,
          activities: allActivities.length,
          interviews: allInterviews.length,
          placements: allPlacements.length,
          companies: allCompanies.length,
          clientContacts: allClients.length,
        },
        candidates: candidateMatches.map((c) => ({
          id: c.id,
          name: c.name,
          title: c.title,
          company: c.company,
          location: c.location,
          status: c.status,
          matchScore: c.matchScore,
          lastContact: c.lastContact,
          tags: parseJsonArray(c.tags),
          notes: c.notes,
        })),
        jobs: jobMatches.map((j) => ({
          id: j.id,
          title: j.title,
          company: j.company,
          location: j.location,
          stage: j.stage,
          candidateCount: j.candidateCount,
          daysOpen: j.daysOpen,
          feePotential: j.feePotential,
          requirements: parseJsonArray(j.requirements),
        })),
        clientContacts: clientMatches.map((c) => ({ id: c.id, name: c.name, company: c.company, title: c.title, email: c.email, phone: c.phone, location: c.location })),
        recentActivities: allActivities.slice(0, 12),
        upcomingInterviews: allInterviews
          .filter((i) => new Date(i.interviewDate).getTime() >= Date.now())
          .sort((a, b) => new Date(a.interviewDate).getTime() - new Date(b.interviewDate).getTime())
          .slice(0, 8),
        recentPlacements: allPlacements.slice(0, 8),
      };

      const fallbackResponse = () => {
        const lines = [
          `I searched the live CRM data: ${allCandidates.length} candidates, ${allJobs.length} jobs, ${allCompanies.length} companies, and ${allClients.length} client contacts.`,
        ];
        if (candidateMatches.length) {
          lines.push(`Top candidate matches: ${candidateMatches.slice(0, 5).map((c) => `${c.name} (${c.title}, ${c.company}, ${c.status}, ${c.matchScore}% match)`).join("; ")}.`);
        }
        if (jobMatches.length) {
          lines.push(`Relevant searches/jobs: ${jobMatches.slice(0, 4).map((j) => `${j.title} at ${j.company} (${j.stage})`).join("; ")}.`);
        }
        if (clientMatches.length) {
          lines.push(`Relevant client contacts: ${clientMatches.slice(0, 4).map((c) => `${c.name}${c.title ? `, ${c.title}` : ""} at ${c.company}`).join("; ")}.`);
        }
        if (lines.length === 1) lines.push("I did not find a direct match for those terms. Try a candidate name, company, role title, status, or location.");
        return {
          content: lines.join("\n\n"),
          cards: candidateMatches.slice(0, 5).map((c) => ({
            name: c.name,
            title: `${c.title} — ${c.company}`,
            score: c.matchScore || 0,
            reason: [c.status, c.location, c.notes].filter(Boolean).join(" • ").slice(0, 220),
          })),
        };
      };

      try {
        const wantsEmail = /\b(email|outreach|draft|message|linkedin note)\b/i.test(query);
        const content = await callClaude(
          `User request: ${query}\n\nLive CRM snapshot:\n${JSON.stringify(snapshot, null, 2)}\n\nAnswer using only this live CRM snapshot. Be concise, specific, and useful. If drafting outreach, include a ready-to-send draft and mention which CRM record it is based on. Do not claim access to data not shown.`,
          "You are HireCommand's AI recruiting assistant. You analyze live CRM data for executive recruiters. Never say 'in the full version'. Never use sample/demo data. If data is thin, say exactly what is missing and provide the best answer from available records.",
          wantsEmail ? 1800 : 1200,
        );
        const cards = candidateMatches.slice(0, 5).map((c) => ({
          name: c.name,
          title: `${c.title} — ${c.company}`,
          score: c.matchScore || 0,
          reason: [c.status, c.location, c.notes].filter(Boolean).join(" • ").slice(0, 220),
        }));
        res.json({ content, cards });
      } catch (aiError: any) {
        res.json({ ...fallbackResponse(), warning: aiError?.message || "AI model unavailable; returned live CRM search results instead." });
      }
    } catch (e: any) {
      res.status(500).json({ error: e.message || "AI assistant failed" });
    }
  });

  // ======================== AI CANDIDATE EVALUATION ========================
  // Browser-safe Anthropic proxy. Keep ANTHROPIC_API_KEY server-side; never ship it to the client.
  app.post("/api/evaluate", async (req, res) => {
    try {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "ANTHROPIC_API_KEY is not configured on the server" });
      }

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify(req.body),
      });

      const data = await response.json();
      if (!response.ok) {
        return res.status(response.status).json(data);
      }
      res.json(data);
    } catch (e: any) {
      res.status(500).json({ error: e.message || "Candidate evaluation failed" });
    }
  });

  // ======================== CLIENT PORTAL ========================
  // Real client portal data built from synced Loxo jobs, job-candidate assignments, and client contacts.
  app.get("/api/client-portal", async (_req, res) => {
    try {
      const [allJobs, allContacts] = await Promise.all([
        storage.getJobs(),
        storage.getLoxoClients(),
      ]);

      const normalize = (name: string) => name.trim().replace(/\s+/g, " ");
      const slugify = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "client";
      const stageLabel = (stage: string) => {
        const s = (stage || "sourcing").toLowerCase();
        if (s.includes("interview")) return "Interview";
        if (s.includes("screen")) return "Screening";
        if (s.includes("offer")) return "Offer";
        if (s.includes("place")) return "Placed";
        return "Sourcing";
      };
      const byCompany = new Map<string, any>();
      const ensureClient = (companyName: string) => {
        const name = normalize(companyName || "");
        if (!name || ["unknown", "unknown company"].includes(name.toLowerCase())) return null;
        const key = name.toLowerCase();
        if (!byCompany.has(key)) {
          byCompany.set(key, {
            id: slugify(name),
            name,
            sponsor: "Live Loxo data",
            slug: slugify(name),
            lastActivity: "Synced from Loxo",
            searches: [],
            candidates: [],
            contacts: [],
            activity: [],
            notes: [],
          });
        }
        return byCompany.get(key);
      };

      for (const contact of allContacts) {
        const client = ensureClient(contact.company || "");
        if (!client) continue;
        client.contacts.push(contact);
      }

      for (const job of allJobs.filter((job) => job.stage !== "closed")) {
        const client = ensureClient(job.company);
        if (!client) continue;
        const assigned = await storage.getCandidatesForJob(job.id);
        const stageCounts = { Sourcing: 0, Screening: 0, Interview: 0, Offer: 0, Placed: 0 } as Record<string, number>;
        for (const candidate of assigned) stageCounts[stageLabel((candidate as any).assignmentStatus || candidate.status)] += 1;
        if (assigned.length === 0) stageCounts[stageLabel(job.stage)] = Math.max(0, job.candidateCount || 0);

        client.searches.push({
          id: String(job.id),
          title: job.title,
          openDate: `${job.daysOpen || 0} days open`,
          daysOpen: job.daysOpen || 0,
          owner: "THA",
          health: job.daysOpen > 60 ? "At Risk" : "Healthy",
          atRiskReason: job.daysOpen > 60 ? `Open ${job.daysOpen} days` : undefined,
          stageCounts,
        });

        for (const candidate of assigned) {
          const assignmentStatus = (candidate as any).assignmentStatus || candidate.status;
          const stage = stageLabel(assignmentStatus);
          client.candidates.push({
            id: String(candidate.id),
            name: candidate.name,
            title: candidate.title,
            company: candidate.company,
            email: candidate.email,
            phone: candidate.phone,
            linkedin: candidate.linkedin,
            searchId: String(job.id),
            stage,
            lastAction: candidate.notes?.slice(0, 80) || `Assigned to ${job.title}`,
            lastActionDate: candidate.lastContact || "Synced from Loxo",
            health: assignmentStatus?.toLowerCase().includes("stalled") ? "Stalled" : "Healthy",
          });
          client.activity.push({
            id: `job-${job.id}-candidate-${candidate.id}`,
            date: candidate.lastContact || "Synced from Loxo",
            type: stage === "Interview" ? "interview" : stage === "Screening" ? "call" : "note",
            description: `${candidate.name} is ${stage.toLowerCase()} for ${job.title}`,
            person: "THA",
          });
        }
      }

      for (const client of Array.from(byCompany.values())) {
        client.lastActivity = client.activity[0]?.date || (client.searches[0] ? "Active search" : "Synced from Loxo");
        if (client.contacts[0]) {
          client.sponsor = `Contact: ${client.contacts[0].name}${client.contacts[0].title ? `, ${client.contacts[0].title}` : ""}`;
        }
      }

      res.json(Array.from(byCompany.values())
        .filter((client: any) => client.searches.length > 0)
        .sort((a: any, b: any) => b.searches.length - a.searches.length || a.name.localeCompare(b.name)));
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ======================== CANDIDATES ========================
  function normalizeCandidateKey(value: string | null | undefined) {
    return String(value || "")
      .toLowerCase()
      .replace(/^https?:\/\/(www\.)?/, "")
      .replace(/\/$/, "")
      .replace(/[^a-z0-9@.\/\-]/g, "")
      .trim();
  }

  function candidateDuplicateGroups(allCandidates: Awaited<ReturnType<typeof storage.getCandidates>>) {
    const groups = new Map<string, typeof allCandidates>();
    const add = (key: string, candidate: typeof allCandidates[number]) => {
      if (!key) return;
      const existing = groups.get(key) || [];
      existing.push(candidate);
      groups.set(key, existing);
    };

    for (const candidate of allCandidates) {
      const email = normalizeCandidateKey(candidate.email);
      const linkedin = normalizeCandidateKey(candidate.linkedin).replace(/linkedin\.com\/in\//, "");
      if (email) add(`email:${email}`, candidate);
      if (linkedin) add(`linkedin:${linkedin}`, candidate);
      const name = normalizeCandidateKey(candidate.name).replace(/\./g, "");
      const company = normalizeCandidateKey(candidate.company).replace(/\./g, "");
      const title = normalizeCandidateKey(candidate.title).replace(/\./g, "");
      if (name && (company || title)) add(`person:${name}|${company}|${title}`, candidate);
    }

    const seenSets = new Set<string>();
    return Array.from(groups.entries())
      .filter(([, candidates]) => candidates.length > 1)
      .map(([key, candidates]) => {
        const unique = Array.from(new Map(candidates.map((candidate) => [candidate.id, candidate])).values());
        return { key, candidates: unique };
      })
      .filter((group) => group.candidates.length > 1)
      .map((group) => {
        const ids = group.candidates.map((candidate) => candidate.id).sort((a, b) => a - b);
        const fingerprint = ids.join(",");
        if (seenSets.has(fingerprint)) return null;
        seenSets.add(fingerprint);
        const confidence = group.key.startsWith("email:") || group.key.startsWith("linkedin:") ? "high" : "medium";
        const primary = group.candidates.reduce((best, candidate) => {
          const score = (candidate.loxoId ? 20 : 0) + (candidate.linkedin ? 8 : 0) + (candidate.email ? 6 : 0) + (candidate.notes?.length || 0) / 100 + candidate.id / 1_000_000;
          const bestScore = (best.loxoId ? 20 : 0) + (best.linkedin ? 8 : 0) + (best.email ? 6 : 0) + (best.notes?.length || 0) / 100 + best.id / 1_000_000;
          return score > bestScore ? candidate : best;
        }, group.candidates[0]);
        return {
          key: group.key,
          confidence,
          primaryId: primary.id,
          candidateIds: ids,
          candidates: group.candidates.map((candidate) => ({
            id: candidate.id,
            loxoId: candidate.loxoId,
            name: candidate.name,
            title: candidate.title,
            company: candidate.company,
            email: candidate.email,
            phone: candidate.phone,
            linkedin: candidate.linkedin,
            status: candidate.status,
            matchScore: candidate.matchScore,
            lastContact: candidate.lastContact,
          })),
        };
      })
      .filter(Boolean)
      .sort((a: any, b: any) => (a.confidence === b.confidence ? 0 : a.confidence === "high" ? -1 : 1));
  }

  app.get("/api/candidates", async (_req, res) => {
    const data = await storage.getCandidates();
    const full = _req.query.full === "1" || _req.query.full === "true";
    res.json(full ? data : data.map((candidate) => ({ ...candidate, linkedinSnapshot: null })));
  });

  app.get("/api/candidates/duplicates", async (_req, res) => {
    const data = await storage.getCandidates();
    const groups = candidateDuplicateGroups(data);
    res.json({ groups, duplicateGroups: groups.length, duplicateCandidates: groups.reduce((sum: number, group: any) => sum + group.candidates.length, 0) });
  });

  app.post("/api/candidates/duplicates/merge", async (req, res) => {
    const primaryId = Number(req.body?.primaryId);
    const duplicateIds = Array.isArray(req.body?.duplicateIds) ? req.body.duplicateIds.map(Number) : [];
    if (!Number.isFinite(primaryId) || duplicateIds.length === 0) return res.status(400).json({ error: "primaryId and duplicateIds are required" });
    const result = await storage.mergeCandidates(primaryId, duplicateIds);
    res.json(result);
  });

  app.get("/api/candidates/:id", async (req, res) => {
    const data = await storage.getCandidate(Number(req.params.id));
    if (!data) return res.status(404).json({ error: "Not found" });
    res.json(data);
  });

  app.post("/api/candidates", async (req, res) => {
    const parsed = insertCandidateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const data = await storage.createCandidate(parsed.data);
    res.status(201).json(data);
  });

  app.patch("/api/candidates/:id", async (req, res) => {
    const data = await storage.updateCandidate(Number(req.params.id), req.body);
    if (!data) return res.status(404).json({ error: "Not found" });
    res.json(data);
  });

  app.delete("/api/candidates/:id", async (req, res) => {
    await storage.deleteCandidate(Number(req.params.id));
    res.status(204).end();
  });

  app.get("/api/candidates/:id/jobs", async (req, res) => {
    const candidateId = Number(req.params.id);
    const candidate = await storage.getCandidate(candidateId);
    if (!candidate) return res.status(404).json({ error: "Candidate not found" });
    const data = await storage.getCandidateJobs(candidateId);
    res.json(data);
  });

  app.post("/api/candidates/:id/jobs", async (req, res) => {
    const candidateId = Number(req.params.id);
    const jobId = Number(req.body?.jobId);
    if (!jobId) return res.status(400).json({ error: "jobId is required" });
    const candidate = await storage.getCandidate(candidateId);
    if (!candidate) return res.status(404).json({ error: "Candidate not found" });
    const job = await storage.getJob(jobId);
    if (!job) return res.status(404).json({ error: "Job not found" });
    if (job.stage === "closed") return res.status(400).json({ error: "Cannot add candidates to a closed job" });
    const data = await storage.addCandidateToJob(candidateId, jobId);
    res.status(201).json(data);
  });

  app.delete("/api/candidates/:id/jobs/:jobId", async (req, res) => {
    await storage.removeCandidateFromJob(Number(req.params.id), Number(req.params.jobId));
    res.status(204).end();
  });

  // ======================== JOBS ========================
  app.get("/api/jobs", async (_req, res) => {
    const data = await storage.getJobs();
    res.json(data);
  });

  app.get("/api/companies", async (_req, res) => {
    const [allJobs, allCandidates, syncedCompanies] = await Promise.all([
      storage.getJobs(),
      storage.getCandidates(),
      storage.getLoxoCompanies(),
    ]);
    const companyMap = new Map<string, any>();

    const normalize = (name: string) => name.trim().replace(/\s+/g, " ");
    const upsert = (name: string, seed: Partial<any> = {}) => {
      const normalized = normalize(name);
      if (!normalized || normalized.toLowerCase() === "unknown" || normalized.toLowerCase() === "unknown company") return null;
      const key = normalized.toLowerCase();
      if (!companyMap.has(key)) {
        companyMap.set(key, {
          id: key.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || String(companyMap.size + 1),
          name: normalized,
          sector: "Loxo CRM",
          peSponsor: "Imported from Loxo",
          revenue: "TBD",
          headcount: 0,
          headcountChange: 0,
          leadershipGaps: [],
          recentHires: [],
          recentDepartures: [],
          fundingStage: "Unknown",
          lastFunding: "Unknown",
          signals: [] as string[],
          momentum: "stable",
          location: seed.location || "",
          openJobs: 0,
          candidateCount: 0,
          loxoJobIds: [] as number[],
        });
      }
      return companyMap.get(key);
    };

    for (const synced of syncedCompanies) {
      const company = upsert(synced.name, { location: synced.location });
      if (!company) continue;
      company.sector = synced.industry || "Loxo CRM";
      company.peSponsor = synced.ownerName ? `Owner: ${synced.ownerName}` : "Synced from Loxo Companies";
      company.location = synced.location || company.location;
      company.website = synced.website;
      company.syncedAt = synced.syncedAt;
      if (!company.signals.includes("loxo-company")) company.signals.push("loxo-company");
    }

    for (const job of allJobs) {
      const company = upsert(job.company, { location: job.location });
      if (!company) continue;
      company.openJobs += job.stage !== "closed" ? 1 : 0;
      if (job.loxoId) company.loxoJobIds.push(job.loxoId);
      if (!company.location && job.location) company.location = job.location;
      if (job.stage !== "closed") {
        company.leadershipGaps.push(job.title);
        if (!company.signals.includes("hiring")) company.signals.push("hiring");
      }
    }

    for (const candidate of allCandidates) {
      const company = upsert(candidate.company, { location: candidate.location });
      if (!company) continue;
      company.candidateCount += 1;
      company.headcount = company.candidateCount;
      if (!company.location && candidate.location) company.location = candidate.location;
    }

    const companies = Array.from(companyMap.values())
      .map((company) => ({
        ...company,
        leadershipGaps: company.leadershipGaps.slice(0, 5),
        momentum: company.openJobs >= 2 ? "accelerating" : company.openJobs === 0 ? "stable" : "stable",
        headcountChange: company.openJobs > 0 ? Math.min(25, company.openJobs * 5) : 0,
        signals: company.signals.length ? company.signals : ["growth"],
        peSponsor: company.openJobs > 0 ? `${company.openJobs} open Loxo search${company.openJobs === 1 ? "" : "es"}` : "Imported from Loxo",
      }))
      .sort((a, b) => (b.openJobs - a.openJobs) || (b.candidateCount - a.candidateCount) || a.name.localeCompare(b.name));

    res.json(companies);
  });

  app.get("/api/clients", async (_req, res) => {
    const data = await storage.getLoxoClients();
    res.json(data);
  });

  app.get("/api/jobs/:id", async (req, res) => {
    const data = await storage.getJob(Number(req.params.id));
    if (!data) return res.status(404).json({ error: "Not found" });
    res.json(data);
  });

  app.get("/api/jobs/:id/candidates", async (req, res) => {
    const jobId = Number(req.params.id);
    const job = await storage.getJob(jobId);
    if (!job) return res.status(404).json({ error: "Job not found" });
    const data = await storage.getCandidatesForJob(jobId);
    res.json(data);
  });

  app.patch("/api/jobs/:jobId/candidates/:candidateId", async (req, res) => {
    const jobId = Number(req.params.jobId);
    const candidateId = Number(req.params.candidateId);
    const status = String(req.body?.status || "").trim();
    const allowed = new Set(["sourced", "contacted", "screening", "interview", "offer", "placed"]);
    if (!allowed.has(status)) return res.status(400).json({ error: "Invalid candidate stage" });
    const job = await storage.getJob(jobId);
    if (!job) return res.status(404).json({ error: "Job not found" });
    const candidate = await storage.getCandidate(candidateId);
    if (!candidate) return res.status(404).json({ error: "Candidate not found" });
    const data = await storage.updateCandidateJobStatus(candidateId, jobId, status);
    if (!data) return res.status(404).json({ error: "Candidate is not assigned to this job" });
    await storage.updateCandidate(candidateId, { status } as any);
    if (status === "interview") {
      const interviews = await storage.getInterviews();
      const exists = interviews.some((i) => i.candidateId === candidateId && i.jobTitle === job.title && i.jobCompany === job.company);
      if (!exists) {
        await storage.createInterview({
          candidateId,
          candidateName: candidate.name,
          candidateTitle: candidate.title || "Candidate",
          jobTitle: job.title,
          jobCompany: job.company,
          interviewType: "first_round",
          interviewDate: candidate.lastContact || new Date().toISOString().slice(0, 10),
          interviewer: "THA",
          duration: 45,
          overallRating: 0,
          notes: `Auto-created from ${job.title} job pipeline stage change.`,
          strengths: "[]",
          concerns: "[]",
          salaryDiscussed: "",
          nextSteps: "Schedule and log interview details",
          recommendation: "hold",
        });
      }
    }
    res.json(data);
  });

  app.post("/api/jobs/:jobId/candidates/:candidateId/evaluate", async (req, res) => {
    try {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) return res.status(500).json({ error: "ANTHROPIC_API_KEY is not configured on the server" });

      const jobId = Number(req.params.jobId);
      const candidateId = Number(req.params.candidateId);
      const [job, candidate] = await Promise.all([storage.getJob(jobId), storage.getCandidate(candidateId)]);
      if (!job) return res.status(404).json({ error: "Job not found" });
      if (!candidate) return res.status(404).json({ error: "Candidate not found" });

      const assigned = await storage.getCandidatesForJob(jobId);
      if (!assigned.some((c) => c.id === candidateId)) {
        return res.status(404).json({ error: "Candidate is not assigned to this job" });
      }

      let requirements: string[] = [];
      try {
        const parsed = JSON.parse(job.requirements || "[]");
        requirements = Array.isArray(parsed) ? parsed : [];
      } catch {}

      let tags: string[] = [];
      try {
        const parsed = JSON.parse(candidate.tags || "[]");
        tags = Array.isArray(parsed) ? parsed : [];
      } catch {}

      const system = `You are a senior executive talent evaluator with 20+ years placing C-suite and VP-level leaders. Evaluate the candidate against the specific job using rigorous, evidence-based criteria.

Score across these 6 dimensions (0-100 each): Performance & Track Record, Leadership Quality, Strategic Fit, Cultural & Behavioral, Market Signals, Modern Leadership Readiness.

Respond ONLY with valid JSON. No markdown fences, no preamble. Exact schema:
{"overall_score":85,"verdict":"Strong Hire","executive_summary":"2-3 sentences covering the top fit signal and top risk.","stage_match_note":"One sentence on builder vs scaler vs turnaround fit.","dimensions":[{"name":"Performance & Track Record","score":80,"note":"25-40 word specific observation"}],"strengths":["Specific strength with evidence"],"risks":["Specific risk with reasoning"],"green_flags":["flag"],"red_flags":["flag"],"reference_check_targets":["Who to call and what to probe"],"interview_probes":["[Gap label] Behavioral question"]}`;

      const userContent = `JOB:\nTitle: ${job.title}\nCompany: ${job.company}\nLocation: ${job.location}\nFee potential: ${job.feePotential}\nStage: ${job.stage}\nDescription: ${job.description}\nRequirements:\n${requirements.map((r) => `- ${r}`).join("\n") || "None provided"}\n\n---\n\nCANDIDATE FILE:\nName: ${candidate.name}\nTitle: ${candidate.title}\nCompany: ${candidate.company}\nLocation: ${candidate.location}\nEmail: ${candidate.email}\nPhone: ${candidate.phone}\nLinkedIn: ${candidate.linkedin}\nCurrent pipeline status: ${candidate.status}\nExisting match score: ${candidate.matchScore}\nTags: ${tags.join(", ") || "None"}\nNotes:\n${candidate.notes || "None"}`;

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: req.body?.model || "claude-sonnet-4-20250514",
          max_tokens: req.body?.max_tokens || 1500,
          temperature: req.body?.temperature ?? 0.2,
          system,
          messages: [{ role: "user", content: userContent }],
        }),
      });

      const anthropicData = await response.json();
      if (!response.ok) return res.status(response.status).json(anthropicData);

      const rawText = Array.isArray(anthropicData?.content)
        ? anthropicData.content.map((block: any) => typeof block?.text === "string" ? block.text : "").filter(Boolean).join("\n\n")
        : "";
      const match = rawText.match(/\{[\s\S]*\}/);
      if (!match) return res.status(502).json({ error: "No JSON found in model response", raw: rawText });
      const result = JSON.parse(match[0]);
      const evaluatedAt = new Date().toISOString();
      const saved = await storage.saveCandidateJobEvaluation(candidateId, jobId, {
        score: Number.isFinite(Number(result.overall_score)) ? Number(result.overall_score) : null,
        verdict: typeof result.verdict === "string" ? result.verdict : null,
        summary: typeof result.executive_summary === "string" ? result.executive_summary : null,
        json: JSON.stringify(result),
        evaluatedAt,
      });
      if (!saved) return res.status(404).json({ error: "Candidate is not assigned to this job" });

      res.json({ result, assignment: saved });
    } catch (e: any) {
      res.status(500).json({ error: e.message || "Job candidate evaluation failed" });
    }
  });

  app.post("/api/jobs", async (req, res) => {
    const parsed = insertJobSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const data = await storage.createJob(parsed.data);
    let aiMatches: Awaited<ReturnType<typeof sourceCandidatesForJob>> = [];
    try {
      aiMatches = await sourceCandidatesForJob(data);
    } catch (e: any) {
      console.error("[jobs] automatic AI candidate sourcing failed:", e.message);
    }
    res.status(201).json({ ...data, aiMatches, candidateCount: aiMatches.length });
  });

  app.patch("/api/jobs/:id", async (req, res) => {
    const data = await storage.updateJob(Number(req.params.id), req.body);
    if (!data) return res.status(404).json({ error: "Not found" });
    res.json(data);
  });

  app.delete("/api/jobs/:id", async (req, res) => {
    await storage.deleteJob(Number(req.params.id));
    res.status(204).end();
  });

  // ======================== OPPORTUNITIES ========================
  app.get("/api/opportunities", async (_req, res) => {
    const data = await storage.getOpportunities();
    res.json(data);
  });

  app.get("/api/opportunities/:id", async (req, res) => {
    const data = await storage.getOpportunity(Number(req.params.id));
    if (!data) return res.status(404).json({ error: "Not found" });
    res.json(data);
  });

  app.post("/api/opportunities", async (req, res) => {
    const parsed = insertOpportunitySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const data = await storage.createOpportunity(parsed.data);
    res.status(201).json(data);
  });

  app.patch("/api/opportunities/:id", async (req, res) => {
    const data = await storage.updateOpportunity(Number(req.params.id), req.body);
    if (!data) return res.status(404).json({ error: "Not found" });
    res.json(data);
  });

  app.delete("/api/opportunities/:id", async (req, res) => {
    await storage.deleteOpportunity(Number(req.params.id));
    res.status(204).end();
  });

  // ======================== CAMPAIGNS ========================
  app.get("/api/campaigns", async (_req, res) => {
    const data = await storage.getCampaigns();
    res.json(data);
  });

  app.get("/api/campaigns/:id", async (req, res) => {
    const data = await storage.getCampaign(Number(req.params.id));
    if (!data) return res.status(404).json({ error: "Not found" });
    res.json(data);
  });

  app.post("/api/campaigns", async (req, res) => {
    const parsed = insertCampaignSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const data = await storage.createCampaign(parsed.data);
    res.status(201).json(data);
  });

  app.patch("/api/campaigns/:id", async (req, res) => {
    const data = await storage.updateCampaign(Number(req.params.id), req.body);
    if (!data) return res.status(404).json({ error: "Not found" });
    res.json(data);
  });

  app.delete("/api/campaigns/:id", async (req, res) => {
    await storage.deleteCampaign(Number(req.params.id));
    res.status(204).send();
  });

  // ======================== ACTIVITIES ========================
  app.get("/api/activities", async (_req, res) => {
    const data = await storage.getActivities();
    res.json(data);
  });

  app.post("/api/activities", async (req, res) => {
    const parsed = insertActivitySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const data = await storage.createActivity(parsed.data);
    res.status(201).json(data);
  });

  // ======================== INTERVIEWS ========================
  app.get("/api/interviews", async (_req, res) => {
    const data = await storage.getInterviews();
    const existingKeys = new Set(data.map((i) => `${i.candidateId}:${i.jobTitle.toLowerCase()}:${i.jobCompany.toLowerCase()}`));
    const synthetic: any[] = [];
    const jobs = await storage.getJobs();
    for (const job of jobs.filter((j) => j.stage !== "closed")) {
      const assigned = await storage.getCandidatesForJob(job.id);
      for (const candidate of assigned) {
        const assignmentStatus = ((candidate as any).assignmentStatus || candidate.status || "").toLowerCase();
        if (assignmentStatus !== "interview") continue;
        const key = `${candidate.id}:${job.title.toLowerCase()}:${job.company.toLowerCase()}`;
        if (existingKeys.has(key)) continue;
        synthetic.push({
          id: -Number(`${job.id}${candidate.id}`.slice(0, 8)),
          candidateId: candidate.id,
          candidateName: candidate.name,
          candidateTitle: candidate.title || "Candidate",
          jobTitle: job.title,
          jobCompany: job.company,
          interviewType: "first_round",
          interviewDate: candidate.lastContact || new Date().toISOString().slice(0, 10),
          interviewer: "THA",
          duration: 45,
          overallRating: 0,
          notes: `Auto-added from ${job.title} job pipeline. Candidate is in Interview stage.`,
          strengths: "[]",
          concerns: "[]",
          salaryDiscussed: "",
          nextSteps: "Schedule and log interview details",
          recommendation: "hold",
        });
      }
    }
    res.json([...synthetic, ...data]);
  });

  app.get("/api/interviews/:id", async (req, res) => {
    const data = await storage.getInterview(Number(req.params.id));
    if (!data) return res.status(404).json({ error: "Not found" });
    res.json(data);
  });

  app.post("/api/interviews", async (req, res) => {
    const parsed = insertInterviewSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const data = await storage.createInterview(parsed.data);
    res.status(201).json(data);
  });

  app.patch("/api/interviews/:id", async (req, res) => {
    const data = await storage.updateInterview(Number(req.params.id), req.body);
    if (!data) return res.status(404).json({ error: "Not found" });
    res.json(data);
  });

  app.delete("/api/interviews/:id", async (req, res) => {
    await storage.deleteInterview(Number(req.params.id));
    res.status(204).end();
  });

  // ======================== STATS ========================
  app.get("/api/stats", async (_req, res) => {
    const [allJobs, allCandidates, allInterviews, allPlacements] = await Promise.all([
      storage.getJobs(),
      storage.getCandidates(),
      storage.getInterviews(),
      storage.getPlacements(),
    ]);

    const activeJobs = allJobs.filter((job) => job.stage !== "closed");

    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const interviewsThisWeek = allInterviews.filter(i => {
      const d = new Date(i.interviewDate);
      return d >= startOfWeek && d <= now;
    }).length;

    const placementsMTD = allPlacements.filter(p => {
      const d = new Date(p.placedDate);
      return d >= startOfMonth && d <= now;
    }).length;

    const revenueMTD = allPlacements
      .filter(p => new Date(p.placedDate) >= startOfMonth)
      .reduce((sum, p) => sum + (p.feeAmount || 0), 0);

    const fmtRevenue = (n: number) => {
      if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
      if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
      return `$${n}`;
    };

    const placedCandidates = allPlacements.length;

    res.json({
      activeJobs: activeJobs.length,
      pipelineCandidates: allCandidates.length,
      interviewsThisWeek,
      placementsMTD,
      revenueMTD: fmtRevenue(revenueMTD),
      avgTimeToFill: activeJobs.length > 0
        ? Math.round(activeJobs.reduce((s, j) => s + (j.daysOpen || 0), 0) / activeJobs.length)
        : 0,
      pipeline: {
        sourced: allCandidates.filter(c => c.status === "sourced").length,
        contacted: allCandidates.filter(c => c.status === "contacted").length,
        screening: allCandidates.filter(c => c.status === "screening").length,
        interview: allCandidates.filter(c => c.status === "interview").length,
        offer: allCandidates.filter(c => c.status === "offer").length,
        placed: placedCandidates,
      },
    });
  });

  // ======================== PLACEMENTS & REVENUE ========================

  // Get all placements (with their splits joined)
  app.get("/api/placements", async (_req, res) => {
    const all = await storage.getPlacements();
    // Attach splits to each placement
    const result = await Promise.all(
      all.map(async (p) => ({
        ...p,
        splits: await storage.getSplitsForPlacement(p.id),
      }))
    );
    res.json(result);
  });

  // Get single placement
  app.get("/api/placements/:id", async (req, res) => {
    const p = await storage.getPlacement(Number(req.params.id));
    if (!p) return res.status(404).json({ error: "Not found" });
    const splits = await storage.getSplitsForPlacement(p.id);
    res.json({ ...p, splits });
  });

  // Create placement
  app.post("/api/placements", async (req, res) => {
    const { splits, ...data } = req.body;
    const p = await storage.createPlacement(data);
    if (splits?.length) {
      await storage.upsertSplitsForPlacement(p.id, splits);
    }
    const freshSplits = await storage.getSplitsForPlacement(p.id);
    res.status(201).json({ ...p, splits: freshSplits });
  });

  // Update placement
  app.patch("/api/placements/:id", async (req, res) => {
    const { splits, ...data } = req.body;
    const p = await storage.updatePlacement(Number(req.params.id), data);
    if (!p) return res.status(404).json({ error: "Not found" });
    if (splits !== undefined) {
      await storage.upsertSplitsForPlacement(p.id, splits);
    }
    const freshSplits = await storage.getSplitsForPlacement(p.id);
    res.json({ ...p, splits: freshSplits });
  });

  // Delete placement
  app.delete("/api/placements/:id", async (req, res) => {
    await storage.deletePlacement(Number(req.params.id));
    res.json({ ok: true });
  });

  // Upsert splits for a placement
  app.put("/api/placements/:id/splits", async (req, res) => {
    const { splits } = req.body;
    const updated = await storage.upsertSplitsForPlacement(Number(req.params.id), splits);
    res.json(updated);
  });

  // Per-employee commission export (JSON — frontend converts to CSV)
  app.get("/api/commissions/employee/:name", async (req, res) => {
    const employee = decodeURIComponent(req.params.name);
    const splits = await storage.getSplitsForEmployee(employee);
    // Enrich with placement details
    const rows = await Promise.all(
      splits.map(async (s) => {
        const p = await storage.getPlacement(s.placementId);
        return {
          placementId: s.placementId,
          employee: s.employee,
          jobTitle: p?.jobTitle ?? "",
          company: p?.company ?? "",
          candidateName: p?.candidateName ?? "",
          placedDate: p?.placedDate ?? "",
          salary: p?.salary ?? 0,
          feePercent: p?.feePercent ?? 0,
          totalFee: p?.feeAmount ?? 0,
          splitPercent: s.splitPercent,
          commissionRate: s.commissionRate,
          commissionAmount: s.commissionAmount,
          invoiceStatus: p?.invoiceStatus ?? "",
          paidDate: p?.paidDate ?? "",
        };
      })
    );
    res.json(rows);
  });

  // All commissions summary (for dashboard)
  app.get("/api/commissions/summary", async (_req, res) => {
    const all = await storage.getPlacements();
    const employees = ["Andrew", "Ryan", "Aileen"];
    const summary = await Promise.all(
      employees.map(async (emp) => {
        const splits = await storage.getSplitsForEmployee(emp);
        const totalComm = splits.reduce((s, r) => s + r.commissionAmount, 0);
        const placementIds = [...new Set(splits.map((s) => s.placementId))];
        return { employee: emp, placements: placementIds.length, totalCommission: totalComm };
      })
    );
    const totalRevenue = all.reduce((s, p) => s + p.feeAmount, 0);
    const paidRevenue = all.filter((p) => p.invoiceStatus === "paid").reduce((s, p) => s + (p.paidAmount ?? 0), 0);
    res.json({ totalRevenue, paidRevenue, placements: all.length, byEmployee: summary });
  });

  // ======================== LOXO INTEGRATION ========================
  const LOXO_BASE = "https://app.loxo.co/api";
  const LOXO_SLUG = "the-hiring-advisors-1";

  const compactLocation = (...parts: Array<unknown>): string => parts
    .map((part) => (typeof part === "string" || typeof part === "number" ? String(part).trim() : ""))
    .filter(Boolean)
    .join(", ");

  const loxoLocation = (record: any): string => {
    const cityState = compactLocation(record.city, record.state || record.state_code);
    const zip = record.zip || record.zip_code || record.postal_code || record.postcode;
    const withZip = compactLocation(cityState, zip);
    return withZip || record.location || record.macro_address || record.address?.city || "";
  };

  const loxoEmail = (record: any): string => record.email || record.emails?.[0]?.value || record.emails?.[0]?.email || "";
  const loxoPhone = (record: any): string => record.phone || record.phones?.[0]?.value || record.phones?.[0]?.phone || "";
  const loxoName = (record: any): string => record.name || compactLocation(record.first_name, record.last_name) || record.full_name || "";
  const loxoCompanyName = (record: any): string => {
    const value = record.company || record.current_company || record.company_name || record.client_company || record.client_company_name || record.organization || record.employer;
    if (!value) return "";
    if (typeof value === "string") return value;
    return value.name || value.company_name || value.title || "";
  };
  const loxoList = (data: any, keys: string[]): any[] => {
    for (const key of keys) if (Array.isArray(data?.[key])) return data[key];
    for (const key of keys) if (Array.isArray(data?.data?.[key])) return data.data[key];
    if (Array.isArray(data?.items)) return data.items;
    if (Array.isArray(data?.data?.items)) return data.data.items;
    if (Array.isArray(data?.results)) return data.results;
    if (Array.isArray(data?.data)) return data.data;
    return [];
  };
  const isActiveLoxoJob = (job: any): boolean => {
    const raw = [job.status?.name, job.status, job.state, job.workflow_state, job.job_status]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    if (!raw) return true;
    return !/(closed|inactive|archived|cancelled|canceled|filled|placed|lost|on hold|hold)/.test(raw);
  };

  // Save credentials
  app.post("/api/loxo/credentials", async (req, res) => {
    const { apiKey, slug } = req.body;
    if (!apiKey) return res.status(400).json({ error: "apiKey is required" });
    await storage.setSetting("loxo_api_key", apiKey);
    if (slug) await storage.setSetting("loxo_slug", slug);
    res.json({ ok: true });
  });

  // Test connection
  app.get("/api/loxo/test", async (_req, res) => {
    const apiKey = await storage.getSetting("loxo_api_key");
    const slug = await storage.getSetting("loxo_slug") || LOXO_SLUG;
    if (!apiKey) return res.status(400).json({ error: "No API key configured" });
    try {
      const r = await fetch(`${LOXO_BASE}/${slug}/people?per_page=1`, {
        headers: { Authorization: `Token ${apiKey}` },
      });
      if (!r.ok) return res.status(401).json({ error: "Invalid credentials" });
      const data: any = await r.json();
      res.json({ ok: true, totalPeople: data.total_count });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Sync status
  app.get("/api/loxo/status", async (_req, res) => {
    const lastSync = await storage.getSetting("loxo_last_sync");
    const candidatesSynced = await storage.getSetting("loxo_candidates_synced");
    const jobsSynced = await storage.getSetting("loxo_jobs_synced");
    const companiesSynced = await storage.getSetting("loxo_companies_synced");
    const clientsSynced = await storage.getSetting("loxo_clients_synced");
    const activeJobsSynced = await storage.getSetting("loxo_active_jobs_synced");
    const syncRunning = await storage.getSetting("loxo_sync_running");
    res.json({
      lastSync: lastSync || null,
      candidatesSynced: candidatesSynced ? parseInt(candidatesSynced) : 0,
      jobsSynced: jobsSynced ? parseInt(jobsSynced) : 0,
      activeJobsSynced: activeJobsSynced ? parseInt(activeJobsSynced) : 0,
      companiesSynced: companiesSynced ? parseInt(companiesSynced) : 0,
      clientsSynced: clientsSynced ? parseInt(clientsSynced) : 0,
      isRunning: syncRunning === "true",
    });
  });

  // Full sync — streams progress via SSE
  app.get("/api/loxo/sync", async (req, res) => {
    const apiKey = await storage.getSetting("loxo_api_key");
    const slug = await storage.getSetting("loxo_slug") || LOXO_SLUG;
    if (!apiKey) return res.status(400).json({ error: "No API key configured. Save credentials first." });

    // SSE headers so the client gets live progress
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    const send = (data: object) => res.write(`data: ${JSON.stringify(data)}\n\n`);

    await storage.setSetting("loxo_sync_running", "true");
    let totalCandidates = 0;
    let totalCompanies = 0;
    let totalClients = 0;
    let totalJobs = 0;
    let totalActiveJobs = 0;
    const activeJobLoxoIds: number[] = [];

    try {
      const seenCompanyKeys = new Set<string>();
      const seenClientKeys = new Set<string>();
      const companyKey = (name: string) => name.trim().replace(/\s+/g, " ").toLowerCase();
      const syntheticLoxoId = (key: string) => {
        let hash = 0;
        for (let i = 0; i < key.length; i++) hash = ((hash << 5) - hash + key.charCodeAt(i)) | 0;
        return -Math.max(1, Math.abs(hash));
      };
      const syntheticCompanyId = (name: string) => syntheticLoxoId(`company:${name}`);
      const syntheticClientId = (rawContact: any, fallbackCompany = "") => {
        const key = [
          "client-contact",
          fallbackCompany,
          loxoName(rawContact),
          loxoEmail(rawContact),
          loxoPhone(rawContact),
          rawContact?.linkedin_url || rawContact?.linkedin || "",
        ].map((part) => String(part || "").trim().toLowerCase()).join(":");
        return syntheticLoxoId(key);
      };
      const companyNameFrom = (value: any): string => {
        if (!value) return "";
        if (typeof value === "string") return value;
        return value.name || value.company_name || value.client_company_name || value.title || "";
      };
      const syncCompanyFromLoxo = async (rawCompany: any, fallbackName = "") => {
        const name = companyNameFrom(rawCompany) || fallbackName;
        const normalized = name.trim().replace(/\s+/g, " ");
        if (!normalized || /^unknown( company)?$/i.test(normalized)) return false;
        const key = companyKey(normalized);
        const firstSeenThisRun = !seenCompanyKeys.has(key);
        if (firstSeenThisRun) seenCompanyKeys.add(key);

        const raw = rawCompany && typeof rawCompany === "object" ? rawCompany : { name: normalized };
        await storage.upsertLoxoCompany({
          loxoId: Number(raw.id) || syntheticCompanyId(key),
          name: normalized,
          website: raw.website || raw.url || raw.domain || "",
          location: loxoLocation(raw),
          industry: raw.industry || raw.sector || raw.company_type || "",
          ownerName: raw.owner?.name || raw.owner_name || raw.recruiter?.name || "",
          rawJson: JSON.stringify(raw),
          syncedAt: new Date().toISOString(),
        });
        if (firstSeenThisRun) totalCompanies++;
        return firstSeenThisRun;
      };
      const syncClientContactFromLoxo = async (rawContact: any, fallbackCompanyName = "") => {
        if (!rawContact) return false;
        const name = loxoName(rawContact);
        if (!name) return false;
        const company = loxoCompanyName(rawContact) || fallbackCompanyName;
        const loxoId = Number(rawContact.id) || syntheticClientId(rawContact, company);
        const clientKey = String(loxoId);
        const firstSeenThisRun = !seenClientKeys.has(clientKey);
        if (firstSeenThisRun) seenClientKeys.add(clientKey);

        await storage.upsertLoxoClient({
          loxoId,
          name,
          company,
          title: rawContact.title || rawContact.current_title || rawContact.job_title || rawContact.position || "",
          email: loxoEmail(rawContact),
          phone: loxoPhone(rawContact),
          location: loxoLocation(rawContact),
          rawJson: JSON.stringify({ ...rawContact, _fallbackCompanyName: fallbackCompanyName || undefined }),
          syncedAt: new Date().toISOString(),
        });
        await syncCompanyFromLoxo(rawContact.company || rawContact.current_company || rawContact.company_name || rawContact.client_company || rawContact.client_company_name || company, company);
        if (firstSeenThisRun) totalClients++;
        return firstSeenThisRun;
      };
      const companyContactsFrom = (company: any): any[] => {
        const contactKeys = ["contacts", "clients", "client_contacts", "people", "hiring_managers", "owners"];
        for (const key of contactKeys) {
          if (Array.isArray(company?.[key])) return company[key];
          if (Array.isArray(company?.data?.[key])) return company.data[key];
        }
        return [];
      };
      const fetchLoxoJson = async (path: string): Promise<any | null> => {
        const r = await fetch(`${LOXO_BASE}/${slug}/${path}`, {
          headers: { Authorization: `Token ${apiKey}` },
        });
        if (r.status === 404) return null;
        if (!r.ok) return null;
        return r.json();
      };
      const syncEmbeddedCompanyContacts = async (rawCompany: any, fallbackCompanyName = "") => {
        const companyName = companyNameFrom(rawCompany) || fallbackCompanyName;
        const contacts = companyContactsFrom(rawCompany);
        for (const contact of contacts) {
          await syncClientContactFromLoxo(
            { ...contact, company: contact.company || contact.company_name || contact.client_company || rawCompany },
            companyName,
          );
        }
        return contacts.length;
      };
      const syncCompanyContactsFromLoxo = async (rawCompany: any, endpoint = "companies") => {
        const companyName = companyNameFrom(rawCompany);
        let contactCount = await syncEmbeddedCompanyContacts(rawCompany, companyName);
        const companyId = rawCompany?.id;
        if (!companyId) return contactCount;

        // Company list rows often omit contacts. Pull the company detail and common
        // nested contact collections so client/company contacts are not lost.
        const detail = await fetchLoxoJson(`${endpoint}/${companyId}`)
          || (endpoint !== "companies" ? await fetchLoxoJson(`companies/${companyId}`) : null);
        if (detail) {
          const detailCompany = detail.company || detail.client_company || detail.data || detail;
          await syncCompanyFromLoxo(detailCompany, companyName);
          contactCount += await syncEmbeddedCompanyContacts(detailCompany, companyName);
        }

        for (const nestedPath of [
          `${endpoint}/${companyId}/contacts`,
          `${endpoint}/${companyId}/people`,
          `${endpoint}/${companyId}/clients`,
          `companies/${companyId}/contacts`,
          `companies/${companyId}/people`,
          `companies/${companyId}/clients`,
        ]) {
          const data = await fetchLoxoJson(`${nestedPath}?per_page=100`);
          if (!data) continue;
          const contacts = loxoList(data, ["contacts", "clients", "client_contacts", "people"]);
          for (const contact of contacts) {
            await syncClientContactFromLoxo(
              { ...contact, company: contact.company || contact.company_name || contact.client_company || rawCompany },
              companyName,
            );
          }
          contactCount += contacts.length;
        }
        return contactCount;
      };
      const isLikelyClientContact = (record: any): boolean => {
        const raw = [record.type, record.person_type, record.category, record.role, record.contact_type, record.kind, record.status?.name]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return Boolean(record.client_company || record.client_company_name || record.is_client || record.client || /client|contact|hiring manager|decision maker/.test(raw));
      };
      const loxoJobFromPipelineRecord = (record: any): any => record.job || record.job_order || record.opening || record.position || record;
      const loxoJobId = (record: any): number => Number(record?.id || record?.job_id || record?.jobId || record?.loxo_id || record?.loxoId || 0);
      const loxoJobTitle = (record: any): string => record.title || record.name || record.published_name || record.job_title || record.position_title || "Untitled";
      const stageFromLoxoJob = (record: any): string => {
        const raw = [record.status?.name, record.status, record.state, record.workflow_state, record.job_status, record.stage, record.pipeline_stage]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (raw.includes("offer")) return "offer";
        if (raw.includes("interview")) return "interview";
        if (raw.includes("screen")) return "screening";
        if (raw.includes("intake")) return "intake";
        return "sourcing";
      };
      const upsertActiveJobFromLoxo = async (rawJob: any) => {
        const j = loxoJobFromPipelineRecord(rawJob);
        const id = loxoJobId(j);
        if (!id || !isActiveLoxoJob(j)) return null;
        if (!activeJobLoxoIds.includes(id)) activeJobLoxoIds.push(id);

        const location = loxoLocation(j);
        const companyName = loxoCompanyName(j) || "Unknown Company";
        const openedAt = j.opened_at || j.created_at || j.start_date;
        const daysOpen = openedAt
          ? Math.floor((Date.now() - new Date(openedAt).getTime()) / 86400000)
          : 0;
        const salary = parseFloat(j.salary || j.salary_max || j.compensation || "") || 0;
        const feePotential = salary > 0 ? `$${Math.round(salary * 0.2 / 1000)}K` : "TBD";

        const job = await storage.upsertJobFromLoxo({
          loxoId: id,
          title: loxoJobTitle(j),
          company: companyName,
          location,
          stage: stageFromLoxoJob(j),
          candidateCount: Number(j.candidate_count || j.candidates_count || j.people_count || j.submissions_count || 0),
          daysOpen: Math.max(0, Math.min(daysOpen, 9999)),
          feePotential,
          description: j.description || j.published_description || j.published_name || j.title || "",
          requirements: JSON.stringify([j.requirements, j.skills, j.specialties].filter(Boolean)),
        });
        await syncCompanyFromLoxo(j.company || j.company_name || j.client_company || j.client_company_name || companyName, companyName);
        return job;
      };

      // --- Sync People (candidates) via scroll_id first, then page fallback ---
      send({ phase: "people", message: "Fetching all candidates from Loxo...", progress: 0 });
      const maxPeopleParam = parseInt((req.query.maxPeople as string) || "0");
      const maxPeople = Number.isFinite(maxPeopleParam) && maxPeopleParam > 0 ? maxPeopleParam : Number.POSITIVE_INFINITY;
      const peoplePerPage = 100;
      const seenPeople = new Set<number>();
      const processPeople = async (people: any[]) => {
        for (const p of people) {
          if (!p?.id || seenPeople.has(p.id)) continue;
          seenPeople.add(p.id);
          const email = p.emails?.[0]?.value || "";
          const phone = p.phones?.[0]?.value || "";
          const location = loxoLocation(p);
          const tags = p.all_raw_tags
            ? p.all_raw_tags.split(",").map((t: string) => t.trim()).filter(Boolean)
            : [];
          const candidateJobs: any[] = p.candidate_jobs || [];
          let status = "sourced";
          if (candidateJobs.length > 0) status = "contacted";

          if (isLikelyClientContact(p)) {
            await syncClientContactFromLoxo(p);
          }

          const candidate = {
            loxoId: p.id,
            name: loxoName(p) || "Unknown",
            title: p.current_title || "",
            company: loxoCompanyName(p),
            location,
            email: email || loxoEmail(p),
            phone: phone || loxoPhone(p),
            linkedin: p.linkedin_url || "",
            status,
            lastContact: p.updated_at ? p.updated_at.slice(0, 10) : new Date().toISOString().slice(0, 10),
            tags: JSON.stringify(tags.slice(0, 6)),
            notes: p.skillsets ? `Skills: ${p.skillsets.slice(0, 200)}` : "",
            timeline: JSON.stringify([{ date: p.updated_at?.slice(0, 10) || new Date().toISOString().slice(0, 10), event: "Synced from Loxo" }]),
          };

          const scoredCandidate = {
            ...candidate,
            matchScore: calculateCandidateMatchScore({
              ...candidate,
              skillsets: p.skillsets,
              rawJson: JSON.stringify(p),
              loxoRaw: p,
            }),
          };

          const savedCandidate = await storage.upsertCandidateFromLoxo(scoredCandidate);
          await syncCompanyFromLoxo(p.company || p.current_company || p.current_company_name || p.client_company || p.client_company_name, candidate.company);

          for (const pipelineRecord of candidateJobs) {
            const job = await upsertActiveJobFromLoxo(pipelineRecord);
            if (job?.id) {
              await storage.addCandidateToJob(savedCandidate.id, job.id);
              const pipelineStatus = String(pipelineRecord.status?.name || pipelineRecord.status || pipelineRecord.stage || "").toLowerCase();
              if (pipelineStatus) await storage.updateCandidateJobStatus(savedCandidate.id, job.id, stageFromLoxoJob(pipelineRecord));
            }
          }
          totalCandidates++;
        }
      };

      let scrollId: string | null = null;
      let scrollPage = 0;
      while (totalCandidates < maxPeople) {
        const url = scrollId
          ? `${LOXO_BASE}/${slug}/people?per_page=${peoplePerPage}&scroll_id=${encodeURIComponent(scrollId)}`
          : `${LOXO_BASE}/${slug}/people?per_page=${peoplePerPage}`;

        const r = await fetch(url, { headers: { Authorization: `Token ${apiKey}` } });
        if (!r.ok) { send({ error: `Loxo people API error: ${r.status}` }); break; }
        const data: any = await r.json();
        const people = loxoList(data, ["people"]);
        if (people.length === 0) break;

        await processPeople(people);
        scrollId = data.scroll_id || data.next_scroll_id || null;
        scrollPage++;

        send({
          phase: "people",
          message: `Synced ${totalCandidates} candidates...`,
          progress: Math.min(30, Math.round(scrollPage * 2)),
          count: totalCandidates,
        });

        if (!scrollId) break;
      }

      // Some Loxo accounts cap scroll windows. Keep paging until Loxo returns an empty/short page.
      let peoplePage = 1;
      let emptyOrDuplicatePages = 0;
      while (totalCandidates < maxPeople && peoplePage <= 10000 && emptyOrDuplicatePages < 3) {
        const r = await fetch(`${LOXO_BASE}/${slug}/people?per_page=${peoplePerPage}&page=${peoplePage}`, {
          headers: { Authorization: `Token ${apiKey}` },
        });
        if (!r.ok) { send({ phase: "people", message: `Stopping paged people sync: Loxo returned ${r.status}` }); break; }
        const data: any = await r.json();
        const people = loxoList(data, ["people"]);
        if (people.length === 0) break;

        const before = totalCandidates;
        await processPeople(people);
        if (totalCandidates === before) emptyOrDuplicatePages++;
        else emptyOrDuplicatePages = 0;

        send({
          phase: "people",
          message: `Synced ${totalCandidates} candidates (paged scan ${peoplePage})...`,
          progress: 30,
          count: totalCandidates,
        });

        peoplePage++;
      }

      await storage.setSetting("loxo_candidates_synced", String(totalCandidates));
      send({ phase: "people", message: `✓ ${totalCandidates} candidates synced`, progress: 35 });

      // --- Sync Companies ---
      send({ phase: "companies", message: "Fetching companies from Loxo...", progress: 35 });
      for (const endpoint of ["companies", "client_companies", "company", "client-companies"]) {
        let page = 1;
        let hasMore = true;
        while (hasMore && page <= 500) {
          const r = await fetch(`${LOXO_BASE}/${slug}/${endpoint}?per_page=100&page=${page}`, {
            headers: { Authorization: `Token ${apiKey}` },
          });
          if (r.status === 404) break;
          if (!r.ok) { send({ phase: "companies", message: `Skipping ${endpoint}: Loxo returned ${r.status}` }); break; }
          const data: any = await r.json();
          const records = loxoList(data, ["companies", "client_companies"]);
          if (records.length === 0) break;

          for (const c of records) {
            if (!c.id || !companyNameFrom(c)) continue;
            await syncCompanyFromLoxo(c);
            await syncCompanyContactsFromLoxo(c, endpoint);
          }

          send({ phase: "companies", message: `Synced ${totalCompanies} companies...`, progress: 35 + Math.min(15, page), count: totalCompanies });
          hasMore = records.length >= 100;
          page++;
        }
      }
      await storage.setSetting("loxo_companies_synced", String(totalCompanies));
      send({ phase: "companies", message: `✓ ${totalCompanies} companies synced`, progress: 50 });

      // --- Sync Clients / Contacts ---
      send({ phase: "clients", message: "Fetching clients and contacts from Loxo...", progress: 50 });
      for (const endpoint of ["clients", "contacts", "client_contacts", "client-contacts"]) {
        let page = 1;
        let hasMore = true;
        while (hasMore && page <= 500) {
          const r = await fetch(`${LOXO_BASE}/${slug}/${endpoint}?per_page=100&page=${page}`, {
            headers: { Authorization: `Token ${apiKey}` },
          });
          if (r.status === 404) break;
          if (!r.ok) { send({ phase: "clients", message: `Skipping ${endpoint}: Loxo returned ${r.status}` }); break; }
          const data: any = await r.json();
          const records = loxoList(data, ["clients", "contacts", "people"]);
          if (records.length === 0) break;

          for (const c of records) {
            await syncClientContactFromLoxo(c);
          }

          send({ phase: "clients", message: `Synced ${totalClients} clients/contacts...`, progress: 50 + Math.min(10, page), count: totalClients });
          hasMore = records.length >= 100;
          page++;
        }
      }
      await storage.setSetting("loxo_clients_synced", String(totalClients));
      send({ phase: "clients", message: `✓ ${totalClients} clients/contacts synced`, progress: 60 });

      // --- Sync Active Jobs ---
      send({ phase: "jobs", message: "Fetching all current active jobs from Loxo...", progress: 60 });
      let jobPage = 1;
      let hasMoreJobs = true;
      const maxJobPages = parseInt((req.query.maxJobPages as string) || "10000"); // safety valve only; default scans until empty page
      const jobsPerPage = 100;
      const seenJobs = new Set<number>();
      let duplicateJobPages = 0;

      for (const jobsPath of ["jobs", "active_jobs", "job_orders"]) {
        jobPage = 1;
        hasMoreJobs = true;
        duplicateJobPages = 0;
      while (hasMoreJobs && jobPage <= maxJobPages) {
        const r = await fetch(
          `${LOXO_BASE}/${slug}/${jobsPath}?per_page=${jobsPerPage}&page=${jobPage}`,
          { headers: { Authorization: `Token ${apiKey}` } }
        );
        if (r.status === 404) break;
        if (!r.ok) { send({ phase: "jobs", message: `Skipping ${jobsPath}: Loxo returned ${r.status}` }); break; }
        const data: any = await r.json();
        const jobsList: any[] = loxoList(data, ["jobs"]);
        if (jobsList.length === 0) { hasMoreJobs = false; break; }

        const seenBeforePage = seenJobs.size;
        for (const j of jobsList) {
          if (!j?.id || seenJobs.has(j.id)) continue;
          seenJobs.add(j.id);
          if (!isActiveLoxoJob(j)) continue;
          if (!activeJobLoxoIds.includes(j.id)) activeJobLoxoIds.push(j.id);
          totalActiveJobs++;
          await upsertActiveJobFromLoxo(j);
          totalJobs++;
        }

        send({
          phase: "jobs",
          message: `Synced ${totalActiveJobs} active jobs (scanned page ${jobPage})`,
          progress: Math.min(99, 60 + Math.round(jobPage / 2)),
          count: totalJobs,
        });

        duplicateJobPages = seenJobs.size === seenBeforePage ? duplicateJobPages + 1 : 0;
        hasMoreJobs = duplicateJobPages < 3;
        jobPage++;
      }
      }

      const closedMissing = await storage.closeMissingLoxoJobs(activeJobLoxoIds);
      await storage.setSetting("loxo_jobs_synced", String(totalJobs));
      await storage.setSetting("loxo_active_jobs_synced", String(totalActiveJobs));
      await storage.setSetting("loxo_jobs_closed_missing", String(closedMissing));
      await storage.setSetting("loxo_last_sync", new Date().toISOString());
      await storage.setSetting("loxo_sync_running", "false");

      send({
        phase: "complete",
        message: `✓ Full Loxo sync complete — ${totalCandidates} candidates, ${totalClients} clients, ${totalCompanies} companies, ${totalActiveJobs} active jobs imported`,
        progress: 100,
        candidatesSynced: totalCandidates,
        clientsSynced: totalClients,
        companiesSynced: totalCompanies,
        jobsSynced: totalJobs,
        activeJobsSynced: totalActiveJobs,
        closedMissingJobs: closedMissing,
      });
      res.end();
    } catch (e: any) {
      await storage.setSetting("loxo_sync_running", "false");
      send({ error: e.message });
      res.end();
    }
  });

  // ======================== INVOICES ========================
  app.get("/api/invoices", async (_req, res) => {
    const data = await storage.getInvoices();
    res.json(data);
  });

  app.get("/api/invoices/:id", async (req, res) => {
    const inv = await storage.getInvoice(parseInt(req.params.id));
    if (!inv) return res.status(404).json({ error: "Not found" });
    res.json(inv);
  });

  app.post("/api/invoices", async (req, res) => {
    const parsed = insertInvoiceSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error });
    const inv = await storage.createInvoice(parsed.data);
    res.status(201).json(inv);
  });

  app.patch("/api/invoices/:id", async (req, res) => {
    const inv = await storage.updateInvoice(parseInt(req.params.id), req.body);
    if (!inv) return res.status(404).json({ error: "Not found" });
    res.json(inv);
  });

  app.delete("/api/invoices/:id", async (req, res) => {
    await storage.deleteInvoice(parseInt(req.params.id));
    res.json({ deleted: true });
  });

  // ======================== CANDIDATE CV IMPORT ========================
  registerCandidateImportRoutes(app);

  // ======================== QUICKBOOKS ========================
  registerQBRoutes(app);

  // ======================== SOURCING ========================
  registerSourcingRoutes(app);

  // ======================== LINKEDIN PROFILE SYNC ========================
  registerLinkedInSyncRoutes(app);

  // ======================== AI SCHEDULING ASSISTANT ========================
  registerSchedulingRoutes(app);

  // ======================== AI TALENT REDISCOVERY ========================
  registerRediscoveryRoutes(app);

  // ======================== OPEN API / SWAGGER ========================
  registerOpenApi(app);

  // Delay startup LinkedIn sync check 60s to let DB connection stabilize
  setTimeout(() => checkAndRunStartupSync(), 60_000);

  return httpServer;
}
