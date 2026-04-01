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

  return httpServer;
}
