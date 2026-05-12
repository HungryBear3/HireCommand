/**
 * HireCommand Public API
 * ----------------------
 * OpenAPI 3.0 specification + Swagger UI + API key auth middleware
 * Versioned under /api/v1
 */

import { type Express, type Request, type Response, type NextFunction } from "express";
import swaggerUi from "swagger-ui-express";
import { v4 as uuidv4 } from "uuid";
import { storage } from "./storage";

// ─── API Key middleware ────────────────────────────────────────────────────────

export async function requireApiKey(req: Request, res: Response, next: NextFunction) {
  const key = req.headers["x-api-key"] as string | undefined;
  if (!key) {
    return res.status(401).json({
      error: "Missing API key",
      hint: "Pass your key as the X-Api-Key header",
    });
  }
  // Keys stored as JSON array in settings
  const raw = await storage.getSetting("api_keys");
  const keys: ApiKeyRecord[] = raw ? JSON.parse(raw) : [];
  const match = keys.find((k) => k.key === key && k.active);
  if (!match) {
    return res.status(401).json({ error: "Invalid or revoked API key" });
  }
  // Attach metadata to request for downstream use
  (req as any).apiKeyName = match.name;
  next();
}

export interface ApiKeyRecord {
  id: string;
  name: string;
  key: string;
  active: boolean;
  createdAt: string;
  lastUsed: string | null;
  scopes: string[]; // e.g. ["read:candidates", "write:placements"]
}

// ─── OpenAPI 3.0 spec ─────────────────────────────────────────────────────────

const spec = {
  openapi: "3.0.0",
  info: {
    title: "HireCommand API",
    version: "1.0.0",
    description: `
## HireCommand Public API

Integrate your external tools, data sources, and automation workflows directly with HireCommand.

### Authentication
All requests require an **API key** in the \`X-Api-Key\` header:
\`\`\`
X-Api-Key: hc_live_your_key_here
\`\`\`

Generate keys in **Settings → API Keys**.

### Base URL
\`\`\`
https://your-deployment.com/api/v1
\`\`\`

### Rate Limits
- 1,000 requests / hour per API key
- Bulk endpoints: 100 requests / hour

### Webhooks
Subscribe to real-time events via **Settings → Webhooks**. Events: \`placement.created\`, \`candidate.updated\`, \`job.status_changed\`.
    `.trim(),
    contact: {
      name: "The Hiring Advisors",
      url: "https://www.thehiringadvisors.com",
      email: "andrew@thehiringadvisors.com",
    },
  },
  servers: [
    { url: "/api/v1", description: "Current server" },
  ],
  security: [{ ApiKeyAuth: [] }],
  components: {
    securitySchemes: {
      ApiKeyAuth: {
        type: "apiKey",
        in: "header",
        name: "X-Api-Key",
      },
    },
    schemas: {
      Candidate: {
        type: "object",
        properties: {
          id: { type: "integer" },
          name: { type: "string", example: "Sarah Chen" },
          title: { type: "string", example: "CFO" },
          company: { type: "string", example: "Meridian Health Partners" },
          location: { type: "string", example: "New York, NY" },
          email: { type: "string", format: "email" },
          phone: { type: "string" },
          linkedin: { type: "string" },
          matchScore: { type: "integer", minimum: 0, maximum: 100 },
          status: {
            type: "string",
            enum: ["sourced", "contacted", "screening", "interview", "offer", "placed"],
          },
          lastContact: { type: "string", format: "date" },
          tags: { type: "array", items: { type: "string" } },
          notes: { type: "string" },
        },
      },
      Job: {
        type: "object",
        properties: {
          id: { type: "integer" },
          title: { type: "string", example: "Chief Financial Officer" },
          company: { type: "string", example: "Acme Health (Thoma Bravo)" },
          location: { type: "string" },
          stage: {
            type: "string",
            enum: ["intake", "sourcing", "screening", "interview", "offer", "placed"],
          },
          candidateCount: { type: "integer" },
          daysOpen: { type: "integer" },
          feePotential: { type: "string", example: "$125,000" },
          description: { type: "string" },
        },
      },
      Placement: {
        type: "object",
        properties: {
          id: { type: "integer" },
          jobTitle: { type: "string" },
          company: { type: "string" },
          clientName: { type: "string" },
          candidateName: { type: "string" },
          salary: { type: "number", example: 350000 },
          feePercent: { type: "number", example: 25 },
          feeAmount: { type: "number", example: 87500 },
          invoiceStatus: {
            type: "string",
            enum: ["pending", "invoiced", "partial", "paid"],
          },
          placedDate: { type: "string", format: "date" },
          leadRecruiter: { type: "string", enum: ["Andrew", "Ryan", "Aileen"] },
          splits: {
            type: "array",
            items: { $ref: "#/components/schemas/CommissionSplit" },
          },
        },
      },
      CommissionSplit: {
        type: "object",
        properties: {
          employee: { type: "string", enum: ["Andrew", "Ryan", "Aileen"] },
          splitPercent: { type: "number", example: 60 },
          commissionRate: { type: "number", example: 40 },
          commissionAmount: { type: "number", example: 21000 },
        },
      },
      WebhookSubscription: {
        type: "object",
        properties: {
          id: { type: "string" },
          url: { type: "string", format: "uri" },
          events: {
            type: "array",
            items: {
              type: "string",
              enum: [
                "candidate.created",
                "candidate.updated",
                "candidate.status_changed",
                "job.created",
                "job.stage_changed",
                "placement.created",
                "placement.invoice_updated",
                "interview.scheduled",
              ],
            },
          },
          active: { type: "boolean" },
          secret: { type: "string", description: "HMAC secret for signature verification" },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      Error: {
        type: "object",
        properties: {
          error: { type: "string" },
          hint: { type: "string" },
        },
      },
    },
  },
  paths: {
    // ── Candidates ──────────────────────────────────────────────────────────
    "/candidates": {
      get: {
        tags: ["Candidates"],
        summary: "List all candidates",
        description: "Returns all candidates in your pipeline. Supports filtering by status.",
        parameters: [
          { name: "status", in: "query", schema: { type: "string", enum: ["sourced", "contacted", "screening", "interview", "offer", "placed"] } },
          { name: "limit", in: "query", schema: { type: "integer", default: 100, maximum: 500 } },
          { name: "offset", in: "query", schema: { type: "integer", default: 0 } },
        ],
        responses: {
          200: { description: "Array of candidates", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/Candidate" } } } } },
          401: { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
      post: {
        tags: ["Candidates"],
        summary: "Create a candidate",
        description: "Add a new candidate to the pipeline. Useful for pushing candidates from external sourcing tools.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name", "title", "company", "location", "email", "phone", "linkedin", "status"],
                properties: {
                  name: { type: "string" },
                  title: { type: "string" },
                  company: { type: "string" },
                  location: { type: "string" },
                  email: { type: "string" },
                  phone: { type: "string" },
                  linkedin: { type: "string" },
                  status: { type: "string", default: "sourced" },
                  tags: { type: "array", items: { type: "string" } },
                  notes: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          201: { description: "Created candidate", content: { "application/json": { schema: { $ref: "#/components/schemas/Candidate" } } } },
        },
      },
    },
    "/candidates/{id}": {
      get: {
        tags: ["Candidates"],
        summary: "Get a candidate",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        responses: { 200: { description: "Candidate", content: { "application/json": { schema: { $ref: "#/components/schemas/Candidate" } } } }, 404: { description: "Not found" } },
      },
      patch: {
        tags: ["Candidates"],
        summary: "Update a candidate",
        description: "Partial update — only pass fields you want to change.",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/Candidate" } } } },
        responses: { 200: { description: "Updated candidate" } },
      },
      delete: {
        tags: ["Candidates"],
        summary: "Delete a candidate",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        responses: { 200: { description: "Deleted successfully" } },
      },
    },
    // ── Jobs ────────────────────────────────────────────────────────────────
    "/jobs": {
      get: {
        tags: ["Jobs"],
        summary: "List all jobs",
        parameters: [
          { name: "stage", in: "query", schema: { type: "string" } },
          { name: "limit", in: "query", schema: { type: "integer", default: 100 } },
        ],
        responses: { 200: { description: "Array of jobs", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/Job" } } } } } },
      },
      post: {
        tags: ["Jobs"],
        summary: "Create a job",
        description: "Create a new search/job. Can be pushed from your ATS or client intake form.",
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/Job" } } } },
        responses: { 201: { description: "Created job" } },
      },
    },
    "/jobs/{id}": {
      get: {
        tags: ["Jobs"],
        summary: "Get a job",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        responses: { 200: { description: "Job" } },
      },
      patch: {
        tags: ["Jobs"],
        summary: "Update a job",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/Job" } } } },
        responses: { 200: { description: "Updated job" } },
      },
    },
    // ── Placements & Revenue ────────────────────────────────────────────────
    "/placements": {
      get: {
        tags: ["Revenue"],
        summary: "List all placements",
        description: "Returns all completed deals with commission splits attached. Use for syncing revenue data to your accounting or BI tools.",
        responses: { 200: { description: "Array of placements with splits", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/Placement" } } } } } },
      },
      post: {
        tags: ["Revenue"],
        summary: "Log a placement",
        description: "Record a completed deal. Pass `splits` array to set commission splits in one call.",
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/Placement" } } } },
        responses: { 201: { description: "Created placement with splits" } },
      },
    },
    "/placements/{id}": {
      patch: {
        tags: ["Revenue"],
        summary: "Update a placement",
        description: "Update invoice status, paid date, paid amount, or commission splits.",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/Placement" } } } },
        responses: { 200: { description: "Updated placement" } },
      },
      delete: {
        tags: ["Revenue"],
        summary: "Delete a placement",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        responses: { 200: { description: "Deleted" } },
      },
    },
    "/commissions/summary": {
      get: {
        tags: ["Revenue"],
        summary: "Commission summary",
        description: "Total revenue, collected, outstanding, and per-employee commission totals.",
        responses: { 200: { description: "Summary object" } },
      },
    },
    "/commissions/employee/{name}": {
      get: {
        tags: ["Revenue"],
        summary: "Per-employee commission detail",
        description: "All commission rows for one employee — ready to export or push to payroll.",
        parameters: [{ name: "name", in: "path", required: true, schema: { type: "string", enum: ["Andrew", "Ryan", "Aileen"] } }],
        responses: { 200: { description: "Array of commission rows" } },
      },
    },
    // ── Webhooks ────────────────────────────────────────────────────────────
    "/webhooks": {
      get: {
        tags: ["Webhooks"],
        summary: "List webhook subscriptions",
        responses: { 200: { description: "Array of subscriptions", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/WebhookSubscription" } } } } } },
      },
      post: {
        tags: ["Webhooks"],
        summary: "Create a webhook subscription",
        description: "Subscribe a URL to receive real-time event payloads. HireCommand signs payloads with HMAC-SHA256 using the returned `secret`.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["url", "events"],
                properties: {
                  url: { type: "string", format: "uri", example: "https://your-system.com/hirecommand-events" },
                  events: {
                    type: "array",
                    items: { type: "string" },
                    example: ["placement.created", "candidate.status_changed"],
                  },
                },
              },
            },
          },
        },
        responses: { 201: { description: "Created subscription with HMAC secret" } },
      },
    },
    "/webhooks/{id}": {
      delete: {
        tags: ["Webhooks"],
        summary: "Delete a webhook subscription",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Deleted" } },
      },
      patch: {
        tags: ["Webhooks"],
        summary: "Update a webhook subscription (activate/deactivate or change events)",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { active: { type: "boolean" }, events: { type: "array", items: { type: "string" } } } } } } },
        responses: { 200: { description: "Updated subscription" } },
      },
    },
    "/webhooks/test": {
      post: {
        tags: ["Webhooks"],
        summary: "Send a test event to a webhook",
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["webhookId"], properties: { webhookId: { type: "string" }, event: { type: "string", default: "candidate.created" } } } } } },
        responses: { 200: { description: "Test delivered" } },
      },
    },
    // ── API Keys (management, no auth required for these) ───────────────────
    "/api-keys": {
      get: {
        tags: ["API Keys"],
        summary: "List API keys",
        description: "Returns all API keys (secrets are masked). Manage in Settings.",
        security: [],
        responses: { 200: { description: "Array of key records" } },
      },
      post: {
        tags: ["API Keys"],
        summary: "Generate a new API key",
        security: [],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name"],
                properties: {
                  name: { type: "string", example: "Zapier Integration" },
                  scopes: { type: "array", items: { type: "string" }, example: ["read:candidates", "write:placements"] },
                },
              },
            },
          },
        },
        responses: { 201: { description: "New key — store it now, it won't be shown again" } },
      },
    },
    "/api-keys/{id}/revoke": {
      post: {
        tags: ["API Keys"],
        summary: "Revoke an API key",
        security: [],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Key revoked" } },
      },
    },
  },
  tags: [
    { name: "Candidates", description: "Manage your candidate pipeline" },
    { name: "Jobs", description: "Active searches and job management" },
    { name: "Revenue", description: "Placements, fees, and commission tracking" },
    { name: "Webhooks", description: "Real-time event subscriptions" },
    { name: "API Keys", description: "API key management" },
  ],
};

// ─── Webhook delivery helper ──────────────────────────────────────────────────

import crypto from "crypto";

export interface WebhookRecord {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  secret: string;
  createdAt: string;
}

async function getWebhooks(): Promise<WebhookRecord[]> {
  const raw = await storage.getSetting("webhooks");
  return raw ? JSON.parse(raw) : [];
}

async function saveWebhooks(hooks: WebhookRecord[]) {
  await storage.setSetting("webhooks", JSON.stringify(hooks));
}

export async function fireWebhook(event: string, payload: object) {
  const hooks = await getWebhooks();
  const targets = hooks.filter((h) => h.active && h.events.includes(event));
  for (const hook of targets) {
    const body = JSON.stringify({ event, data: payload, timestamp: new Date().toISOString() });
    const sig = crypto.createHmac("sha256", hook.secret).update(body).digest("hex");
    fetch(hook.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-HireCommand-Event": event,
        "X-HireCommand-Signature": `sha256=${sig}`,
      },
      body,
    }).catch(() => {}); // fire-and-forget, don't block the response
  }
}

// ─── Register all v1 routes ───────────────────────────────────────────────────

export function registerOpenApi(app: Express) {
  // ── Swagger UI (no auth required) ──────────────────────────────────────────
  app.use(
    "/api/docs",
    swaggerUi.serve,
    swaggerUi.setup(spec, {
      customSiteTitle: "HireCommand API Docs",
      customCss: `
        .swagger-ui .topbar { background: #0f172a; }
        .swagger-ui .topbar-wrapper .link { visibility: hidden; }
        .swagger-ui .topbar-wrapper::before {
          content: "HireCommand API";
          color: white;
          font-size: 18px;
          font-weight: 700;
          padding-left: 16px;
        }
      `,
    })
  );

  // ── Raw spec (for Postman / code-gen) ──────────────────────────────────────
  app.get("/api/openapi.json", (_req, res) => res.json(spec));

  // ── v1 base — all require API key ──────────────────────────────────────────
  const v1 = require("express").Router();
  app.use("/api/v1", requireApiKey, v1);

  // Candidates
  v1.get("/candidates", async (req: Request, res: Response) => {
    let candidates = await storage.getCandidates();
    const { status, limit = "100", offset = "0" } = req.query as any;
    if (status) candidates = candidates.filter((c) => c.status === status);
    const start = parseInt(offset);
    const end = start + parseInt(limit);
    res.json(candidates.slice(start, end).map((c) => ({ ...c, tags: JSON.parse(c.tags || "[]") })));
  });

  v1.get("/candidates/:id", async (req: Request, res: Response) => {
    const c = await storage.getCandidate(Number(req.params.id));
    if (!c) return res.status(404).json({ error: "Not found" });
    res.json({ ...c, tags: JSON.parse(c.tags || "[]") });
  });

  v1.post("/candidates", async (req: Request, res: Response) => {
    const { tags, ...rest } = req.body;
    const data = {
      ...rest,
      tags: JSON.stringify(tags || []),
      matchScore: rest.matchScore ?? 75,
      timeline: JSON.stringify([{ date: new Date().toISOString().slice(0, 10), event: "Added via API" }]),
    };
    const c = await storage.createCandidate(data);
    await fireWebhook("candidate.created", c);
    res.status(201).json(c);
  });

  v1.patch("/candidates/:id", async (req: Request, res: Response) => {
    const { tags, ...rest } = req.body;
    const data = tags !== undefined ? { ...rest, tags: JSON.stringify(tags) } : rest;
    const c = await storage.updateCandidate(Number(req.params.id), data);
    if (!c) return res.status(404).json({ error: "Not found" });
    await fireWebhook("candidate.updated", c);
    res.json(c);
  });

  v1.delete("/candidates/:id", async (req: Request, res: Response) => {
    await storage.deleteCandidate(Number(req.params.id));
    res.json({ ok: true });
  });

  // Jobs
  v1.get("/jobs", async (req: Request, res: Response) => {
    let jobs = await storage.getJobs();
    if (req.query.stage) jobs = jobs.filter((j) => j.stage === req.query.stage);
    res.json(jobs);
  });

  v1.get("/jobs/:id", async (req: Request, res: Response) => {
    const j = await storage.getJob(Number(req.params.id));
    if (!j) return res.status(404).json({ error: "Not found" });
    res.json(j);
  });

  v1.post("/jobs", async (req: Request, res: Response) => {
    const j = await storage.createJob(req.body);
    await fireWebhook("job.created", j);
    res.status(201).json(j);
  });

  v1.patch("/jobs/:id", async (req: Request, res: Response) => {
    const j = await storage.updateJob(Number(req.params.id), req.body);
    if (!j) return res.status(404).json({ error: "Not found" });
    if (req.body.stage) await fireWebhook("job.stage_changed", j);
    res.json(j);
  });

  // Placements
  v1.get("/placements", async (_req: Request, res: Response) => {
    const all = await storage.getPlacements();
    const result = await Promise.all(all.map(async (p) => ({ ...p, splits: await storage.getSplitsForPlacement(p.id) })));
    res.json(result);
  });

  v1.post("/placements", async (req: Request, res: Response) => {
    const { splits, ...data } = req.body;
    const p = await storage.createPlacement(data);
    if (splits?.length) await storage.upsertSplitsForPlacement(p.id, splits);
    const freshSplits = await storage.getSplitsForPlacement(p.id);
    const result = { ...p, splits: freshSplits };
    await fireWebhook("placement.created", result);
    res.status(201).json(result);
  });

  v1.patch("/placements/:id", async (req: Request, res: Response) => {
    const { splits, ...data } = req.body;
    const p = await storage.updatePlacement(Number(req.params.id), data);
    if (!p) return res.status(404).json({ error: "Not found" });
    if (splits !== undefined) await storage.upsertSplitsForPlacement(p.id, splits);
    const freshSplits = await storage.getSplitsForPlacement(p.id);
    const result = { ...p, splits: freshSplits };
    if (data.invoiceStatus) await fireWebhook("placement.invoice_updated", result);
    res.json(result);
  });

  v1.delete("/placements/:id", async (req: Request, res: Response) => {
    await storage.deletePlacement(Number(req.params.id));
    res.json({ ok: true });
  });

  v1.get("/commissions/summary", async (_req: Request, res: Response) => {
    const all = await storage.getPlacements();
    const employees = ["Andrew", "Ryan", "Aileen"];
    const byEmployee = await Promise.all(
      employees.map(async (emp) => {
        const splits = await storage.getSplitsForEmployee(emp);
        return { employee: emp, placements: [...new Set(splits.map((s) => s.placementId))].length, totalCommission: splits.reduce((s, r) => s + r.commissionAmount, 0) };
      })
    );
    res.json({
      totalRevenue: all.reduce((s, p) => s + p.feeAmount, 0),
      paidRevenue: all.filter((p) => p.invoiceStatus === "paid").reduce((s, p) => s + (p.paidAmount ?? 0), 0),
      placements: all.length,
      byEmployee,
    });
  });

  v1.get("/commissions/employee/:name", async (req: Request, res: Response) => {
    const employee = decodeURIComponent(String(req.params.name));
    const splits = await storage.getSplitsForEmployee(employee);
    const rows = await Promise.all(splits.map(async (s) => {
      const p = await storage.getPlacement(s.placementId);
      return { ...s, jobTitle: p?.jobTitle ?? "", company: p?.company ?? "", candidateName: p?.candidateName ?? "", placedDate: p?.placedDate ?? "", salary: p?.salary ?? 0, feePercent: p?.feePercent ?? 0, totalFee: p?.feeAmount ?? 0, invoiceStatus: p?.invoiceStatus ?? "", paidDate: p?.paidDate ?? "" };
    }));
    res.json(rows);
  });

  // ── Webhooks ────────────────────────────────────────────────────────────────
  v1.get("/webhooks", async (_req: Request, res: Response) => {
    const hooks = await getWebhooks();
    res.json(hooks.map((h) => ({ ...h, secret: `${h.secret.slice(0, 8)}...` }))); // mask secret
  });

  v1.post("/webhooks", async (req: Request, res: Response) => {
    const { url, events } = req.body;
    if (!url || !events?.length) return res.status(400).json({ error: "url and events are required" });
    const hook: WebhookRecord = {
      id: uuidv4(),
      url,
      events,
      active: true,
      secret: `whsec_${uuidv4().replace(/-/g, "")}`,
      createdAt: new Date().toISOString(),
    };
    const hooks = await getWebhooks();
    hooks.push(hook);
    await saveWebhooks(hooks);
    res.status(201).json(hook); // return full secret once
  });

  v1.patch("/webhooks/:id", async (req: Request, res: Response) => {
    const hooks = await getWebhooks();
    const idx = hooks.findIndex((h) => h.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Not found" });
    hooks[idx] = { ...hooks[idx], ...req.body };
    await saveWebhooks(hooks);
    res.json(hooks[idx]);
  });

  v1.delete("/webhooks/:id", async (req: Request, res: Response) => {
    const hooks = await getWebhooks();
    await saveWebhooks(hooks.filter((h) => h.id !== req.params.id));
    res.json({ ok: true });
  });

  v1.post("/webhooks/test", async (req: Request, res: Response) => {
    const { webhookId, event = "candidate.created" } = req.body;
    const hooks = await getWebhooks();
    const hook = hooks.find((h) => h.id === webhookId);
    if (!hook) return res.status(404).json({ error: "Webhook not found" });
    const testPayload = { id: 0, name: "Test Candidate", title: "CFO", company: "Test Co", status: "sourced" };
    const body = JSON.stringify({ event, data: testPayload, timestamp: new Date().toISOString(), test: true });
    const sig = crypto.createHmac("sha256", hook.secret).update(body).digest("hex");
    try {
      const r = await fetch(hook.url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-HireCommand-Event": event, "X-HireCommand-Signature": `sha256=${sig}` },
        body,
      });
      res.json({ delivered: true, statusCode: r.status });
    } catch (e: any) {
      res.json({ delivered: false, error: e.message });
    }
  });

  // ── API Key management (no auth — used from Settings UI) ───────────────────
  app.get("/api/api-keys", async (_req: Request, res: Response) => {
    const raw = await storage.getSetting("api_keys");
    const keys: ApiKeyRecord[] = raw ? JSON.parse(raw) : [];
    res.json(keys.map((k) => ({ ...k, key: `${k.key.slice(0, 12)}...` }))); // mask
  });

  app.post("/api/api-keys", async (req: Request, res: Response) => {
    const { name, scopes = ["read:candidates", "read:jobs", "read:placements"] } = req.body;
    if (!name) return res.status(400).json({ error: "name is required" });
    const newKey: ApiKeyRecord = {
      id: uuidv4(),
      name,
      key: `hc_live_${uuidv4().replace(/-/g, "")}`,
      active: true,
      createdAt: new Date().toISOString(),
      lastUsed: null,
      scopes,
    };
    const raw = await storage.getSetting("api_keys");
    const keys: ApiKeyRecord[] = raw ? JSON.parse(raw) : [];
    keys.push(newKey);
    await storage.setSetting("api_keys", JSON.stringify(keys));
    res.status(201).json(newKey); // full key returned only once
  });

  app.post("/api/api-keys/:id/revoke", async (req: Request, res: Response) => {
    const raw = await storage.getSetting("api_keys");
    const keys: ApiKeyRecord[] = raw ? JSON.parse(raw) : [];
    const idx = keys.findIndex((k) => k.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Not found" });
    keys[idx].active = false;
    await storage.setSetting("api_keys", JSON.stringify(keys));
    res.json({ ok: true });
  });

  app.delete("/api/api-keys/:id", async (req: Request, res: Response) => {
    const raw = await storage.getSetting("api_keys");
    const keys: ApiKeyRecord[] = raw ? JSON.parse(raw) : [];
    await storage.setSetting("api_keys", JSON.stringify(keys.filter((k) => k.id !== req.params.id)));
    res.json({ ok: true });
  });
}
