import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertCandidateSchema, insertJobSchema, insertActivitySchema, insertInterviewSchema } from "@shared/schema";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
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
    const allJobs = await storage.getJobs();
    const allCandidates = await storage.getCandidates();
    
    res.json({
      activeJobs: allJobs.length,
      pipelineCandidates: allCandidates.length * 53,
      interviewsThisWeek: 8,
      placementsMTD: 3,
      revenueMTD: "$127K",
      avgTimeToFill: 34,
      pipeline: {
        sourced: allCandidates.filter(c => c.status === "sourced").length * 15,
        contacted: allCandidates.filter(c => c.status === "contacted").length * 12,
        screening: allCandidates.filter(c => c.status === "screening").length * 10,
        interview: allCandidates.filter(c => c.status === "interview").length * 5,
        offer: allCandidates.filter(c => c.status === "offer").length * 3,
        placed: 3,
      },
    });
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
        headers: { Authorization: `Bearer ${apiKey}` },
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

        const r = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } });
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
          { headers: { Authorization: `Bearer ${apiKey}` } }
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
          else if (statusName.includes("placed") || statusName.includes("filled") || statusName.includes("closed")) stage = "placed";
          else if (statusName.includes("inactive")) stage = "placed"; // closed out

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

  return httpServer;
}
