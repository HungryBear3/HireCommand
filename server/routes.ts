import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertCandidateSchema, insertJobSchema, insertActivitySchema, insertInterviewSchema, insertOpportunitySchema, insertCampaignSchema } from "@shared/schema";
import { registerOpenApi } from "./openapi";
import { registerSourcingRoutes } from "./sourcing";
import { registerQBRoutes } from "./quickbooks";
import { registerLinkedInSyncRoutes, checkAndRunStartupSync } from "./linkedin-sync";
import { registerCandidateImportRoutes } from "./candidate-import";
import { registerSchedulingRoutes } from "./scheduling";
import { registerRediscoveryRoutes } from "./rediscovery";
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

  // ======================== CANDIDATES ========================
  app.get("/api/candidates", async (_req, res) => {
    const data = await storage.getCandidates();
    res.json(data);
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

  app.get("/api/jobs/:id", async (req, res) => {
    const data = await storage.getJob(Number(req.params.id));
    if (!data) return res.status(404).json({ error: "Not found" });
    res.json(data);
  });

  app.post("/api/jobs", async (req, res) => {
    const parsed = insertJobSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const data = await storage.createJob(parsed.data);
    res.status(201).json(data);
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
    res.json(data);
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
    const syncRunning = await storage.getSetting("loxo_sync_running");
    res.json({
      lastSync: lastSync || null,
      candidatesSynced: candidatesSynced ? parseInt(candidatesSynced) : 0,
      jobsSynced: jobsSynced ? parseInt(jobsSynced) : 0,
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
    let totalJobs = 0;

    try {
      // --- Sync People (candidates) via scroll_id pagination ---
      send({ phase: "people", message: "Fetching candidates from Loxo...", progress: 0 });
      const maxPeople = parseInt((req.query.maxPeople as string) || "500");
      let scrollId: string | null = null;
      let scrollPage = 0;
      const perPage = 25;
      const maxScrollPages = Math.ceil(maxPeople / perPage);

      while (scrollPage < maxScrollPages) {
        const url = scrollId
          ? `${LOXO_BASE}/${slug}/people?per_page=${perPage}&scroll_id=${encodeURIComponent(scrollId)}`
          : `${LOXO_BASE}/${slug}/people?per_page=${perPage}`;

        const r = await fetch(url, { headers: { Authorization: `Token ${apiKey}` } });
        if (!r.ok) { send({ error: `Loxo API error: ${r.status}` }); break; }
        const data: any = await r.json();
        const people: any[] = data.people || [];
        if (people.length === 0) break;

        scrollId = data.scroll_id || null;

        for (const p of people) {
          const email = p.emails?.[0]?.value || "";
          const phone = p.phones?.[0]?.value || "";
          const location = [p.city, p.state].filter(Boolean).join(", ") || p.location || "";
          const tags = p.all_raw_tags
            ? p.all_raw_tags.split(",").map((t: string) => t.trim()).filter(Boolean)
            : [];
          const candidateJobs: any[] = p.candidate_jobs || [];
          let status = "sourced";
          if (candidateJobs.length > 0) status = "contacted";

          const candidate = {
            loxoId: p.id,
            name: p.name || "Unknown",
            title: p.current_title || "",
            company: p.current_company || "",
            location,
            email,
            phone,
            linkedin: p.linkedin_url || "",
            matchScore: 75,
            status,
            lastContact: p.updated_at ? p.updated_at.slice(0, 10) : new Date().toISOString().slice(0, 10),
            tags: JSON.stringify(tags.slice(0, 6)),
            notes: p.skillsets ? `Skills: ${p.skillsets.slice(0, 200)}` : "",
            timeline: JSON.stringify([{ date: p.updated_at?.slice(0, 10) || new Date().toISOString().slice(0, 10), event: "Synced from Loxo" }]),
          };

          await storage.upsertCandidateFromLoxo(candidate);
          totalCandidates++;
        }

        scrollPage++;
        send({
          phase: "people",
          message: `Synced ${totalCandidates} candidates...`,
          progress: Math.round((scrollPage / maxScrollPages) * 50),
          count: totalCandidates,
        });

        if (!scrollId) break; // No more pages
      }

      await storage.setSetting("loxo_candidates_synced", String(totalCandidates));
      send({ phase: "people", message: `✓ ${totalCandidates} candidates synced`, progress: 50 });

      // --- Sync Jobs ---
      send({ phase: "jobs", message: "Fetching jobs from Loxo...", progress: 50 });
      let jobPage = 1;
      let hasMoreJobs = true;
      const maxJobPages = parseInt((req.query.maxJobPages as string) || "10"); // default ~100 active jobs

      while (hasMoreJobs && jobPage <= maxJobPages) {
        const r = await fetch(
          `${LOXO_BASE}/${slug}/jobs?per_page=25&page=${jobPage}`,
          { headers: { Authorization: `Token ${apiKey}` } }
        );
        if (!r.ok) { send({ error: `Loxo jobs API error: ${r.status}` }); break; }
        const data: any = await r.json();
        const jobsList: any[] = data.results || [];
        if (jobsList.length === 0) { hasMoreJobs = false; break; }

        for (const j of jobsList) {
          const statusName: string = j.status?.name?.toLowerCase() || "";
          // Map to internal stage
          let stage = "intake";
          if (statusName.includes("active") || statusName.includes("open")) stage = "sourcing";
          else if (statusName.includes("screen")) stage = "screening";
          else if (statusName.includes("interview")) stage = "interview";
          else if (statusName.includes("offer")) stage = "offer";
          else if (statusName.includes("placed") || statusName.includes("filled")) stage = "placed";
          else if (statusName.includes("closed") || statusName.includes("inactive")) stage = "closed"; // closed out

          const location = [j.city, j.state_code].filter(Boolean).join(", ") || j.macro_address || "";
          const companyName = j.company?.name || "Unknown Company";
          const daysOpen = j.opened_at
            ? Math.floor((Date.now() - new Date(j.opened_at).getTime()) / 86400000)
            : 0;

          // Estimate fee based on salary
          const salary = parseFloat(j.salary) || 0;
          const feePotential = salary > 0 ? `$${Math.round(salary * 0.2 / 1000)}K` : "TBD";

          const job = {
            loxoId: j.id,
            title: j.title || "Untitled",
            company: companyName,
            location,
            stage,
            candidateCount: 0,
            daysOpen: Math.min(daysOpen, 9999),
            feePotential,
            description: j.published_name || j.title || "",
            requirements: JSON.stringify([]),
          };

          await storage.upsertJobFromLoxo(job);
          totalJobs++;
        }

        const totalPages = data.total_pages || 1;
        send({
          phase: "jobs",
          message: `Synced ${totalJobs} jobs (page ${jobPage}/${Math.min(maxJobPages, totalPages)})`,
          progress: 50 + Math.round((jobPage / Math.min(maxJobPages, totalPages)) * 50),
          count: totalJobs,
        });

        hasMoreJobs = jobPage < data.total_pages;
        jobPage++;
      }

      await storage.setSetting("loxo_jobs_synced", String(totalJobs));
      await storage.setSetting("loxo_last_sync", new Date().toISOString());
      await storage.setSetting("loxo_sync_running", "false");

      send({
        phase: "complete",
        message: `✓ Sync complete — ${totalCandidates} candidates, ${totalJobs} jobs imported`,
        progress: 100,
        candidatesSynced: totalCandidates,
        jobsSynced: totalJobs,
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
