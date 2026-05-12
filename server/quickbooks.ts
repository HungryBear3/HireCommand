/**
 * QuickBooks Online Integration — HireCommand
 *
 * OAuth 2.0 flow:
 *   1. GET  /api/qb/connect     → redirect to Intuit OAuth
 *   2. GET  /api/qb/callback    → exchange code for tokens, store in settings
 *   3. GET  /api/qb/status      → return connection state + company name
 *   4. POST /api/qb/disconnect  → revoke + clear tokens
 *
 * Invoice sync:
 *   5. POST /api/qb/push/:id        → create/update invoice in QB
 *   6. POST /api/qb/sync            → pull all invoices from QB, update paid status
 *   7. POST /api/qb/webhook         → receive QB real-time event (invoice paid)
 *
 * Two-way paid detection:
 *   - Active sync (manual):   POST /api/qb/sync queries QB for all Invoice objects,
 *     matches by qbInvoiceId, marks paid when Balance == 0
 *   - Passive (webhook):      QB fires a webhook to /api/qb/webhook when a Payment
 *     is created; we fetch the invoice and flip status to "paid"
 *
 * Settings keys used:
 *   qb_access_token   — OAuth access token (1hr expiry)
 *   qb_refresh_token  — OAuth refresh token (100-day expiry)
 *   qb_realm_id       — Company ID / realmId
 *   qb_company_name   — Display name, stored after first token exchange
 *   qb_token_expiry   — ISO timestamp when access token expires
 *   qb_last_sync      — ISO timestamp of last successful sync
 */

import type { Express, Request, Response } from "express";
import { storage } from "./storage";

// ─── Constants ────────────────────────────────────────────────────────────────

const QB_BASE = "https://quickbooks.api.intuit.com/v3/company";
const QB_AUTH_URL = "https://appcenter.intuit.com/connect/oauth2";
const QB_TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";
const QB_REVOKE_URL = "https://developer.api.intuit.com/v2/oauth2/tokens/revoke";
const QB_SCOPES = "com.intuit.quickbooks.accounting";
const MINOR_VERSION = "75";

// ─── Config helpers ───────────────────────────────────────────────────────────

function getQBConfig() {
  return {
    clientId: process.env.QB_CLIENT_ID || "",
    clientSecret: process.env.QB_CLIENT_SECRET || "",
    redirectUri: process.env.QB_REDIRECT_URI || `${process.env.APP_URL || "http://localhost:5000"}/api/qb/callback`,
  };
}

async function getSetting(key: string): Promise<string | null> {
  try {
    const row = await storage.getSetting(key);
    return row ?? null;
  } catch {
    return null;
  }
}

async function setSetting(key: string, value: string) {
  await storage.setSetting(key, value);
}

// ─── Token management ─────────────────────────────────────────────────────────

async function getValidAccessToken(): Promise<{ token: string; realmId: string } | null> {
  const [token, refreshToken, realmId, expiry] = await Promise.all([
    getSetting("qb_access_token"),
    getSetting("qb_refresh_token"),
    getSetting("qb_realm_id"),
    getSetting("qb_token_expiry"),
  ]);

  if (!realmId) return null;

  // If token is still valid (with 60s buffer), use it
  if (token && expiry) {
    const expiryMs = new Date(expiry).getTime();
    if (Date.now() < expiryMs - 60_000) {
      return { token, realmId };
    }
  }

  // Try refreshing
  if (!refreshToken) return null;

  try {
    const fresh = await refreshAccessToken(refreshToken);
    return { token: fresh.access_token, realmId };
  } catch (err) {
    console.error("[QB] Token refresh failed:", err);
    return null;
  }
}

async function refreshAccessToken(refreshToken: string) {
  const { clientId, clientSecret } = getQBConfig();
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const resp = await fetch(QB_TOKEN_URL, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Accept": "application/json",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }).toString(),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Token refresh failed: ${resp.status} — ${err}`);
  }

  const data = await resp.json() as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    token_type: string;
  };

  const expiry = new Date(Date.now() + data.expires_in * 1000).toISOString();
  await Promise.all([
    setSetting("qb_access_token", data.access_token),
    setSetting("qb_refresh_token", data.refresh_token),
    setSetting("qb_token_expiry", expiry),
  ]);

  return data;
}

// ─── QB API helpers ───────────────────────────────────────────────────────────

async function qbGet(path: string, token: string, realmId: string) {
  const url = `${QB_BASE}/${realmId}/${path}?minorversion=${MINOR_VERSION}`;
  const resp = await fetch(url, {
    headers: {
      "Authorization": `Bearer ${token}`,
      "Accept": "application/json",
    },
  });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`QB GET ${path} failed: ${resp.status} — ${err}`);
  }
  return resp.json();
}

async function qbPost(path: string, body: unknown, token: string, realmId: string) {
  const url = `${QB_BASE}/${realmId}/${path}?minorversion=${MINOR_VERSION}`;
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`QB POST ${path} failed: ${resp.status} — ${err}`);
  }
  return resp.json();
}

// ─── Customer management ──────────────────────────────────────────────────────

async function findOrCreateQBCustomer(
  clientName: string,
  clientEmail: string,
  token: string,
  realmId: string
): Promise<string> {
  // Query existing customers
  const query = `SELECT * FROM Customer WHERE DisplayName = '${clientName.replace(/'/g, "\\'")}'`;
  const url = `${QB_BASE}/${realmId}/query?query=${encodeURIComponent(query)}&minorversion=${MINOR_VERSION}`;
  const resp = await fetch(url, {
    headers: { "Authorization": `Bearer ${token}`, "Accept": "application/json" },
  });

  if (resp.ok) {
    const data = await resp.json() as { QueryResponse?: { Customer?: Array<{ Id: string }> } };
    const existing = data.QueryResponse?.Customer?.[0];
    if (existing) return existing.Id;
  }

  // Create new customer
  const customerBody = {
    DisplayName: clientName,
    CompanyName: clientName,
    ...(clientEmail ? { PrimaryEmailAddr: { Address: clientEmail } } : {}),
  };

  const result = await qbPost("customer", customerBody, token, realmId) as {
    Customer: { Id: string }
  };
  return result.Customer.Id;
}

// ─── Invoice push to QB ───────────────────────────────────────────────────────

interface QBInvoiceResult {
  Invoice: {
    Id: string;
    SyncToken: string;
    DocNumber: string;
    Balance: number;
    TotalAmt: number;
    DueDate: string;
    MetaData: { CreateTime: string };
  };
}

export async function pushInvoiceToQB(invoiceId: number): Promise<{
  qbInvoiceId: string;
  qbSyncToken: string;
  qbCustomerId: string;
}> {
  const auth = await getValidAccessToken();
  if (!auth) throw new Error("QuickBooks not connected. Please connect your account in Settings.");

  const inv = await storage.getInvoice(invoiceId);
  if (!inv) throw new Error(`Invoice ${invoiceId} not found`);

  const { token, realmId } = auth;

  // Find or create customer in QB
  const customerId = inv.qbCustomerId ||
    await findOrCreateQBCustomer(inv.clientName, inv.clientEmail || "", token, realmId);

  // Build line items
  const lineItems = JSON.parse(inv.lineItems || "[]") as Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    amount: number;
  }>;

  const qbLines = lineItems.map((item, i) => ({
    Amount: item.amount,
    DetailType: "SalesItemLineDetail",
    Description: item.description,
    LineNum: i + 1,
    SalesItemLineDetail: {
      ItemRef: { value: "1", name: "Services" }, // QB Service item
      Qty: item.quantity,
      UnitPrice: item.unitPrice,
    },
  }));

  const invoiceBody: Record<string, unknown> = {
    CustomerRef: { value: customerId },
    Line: qbLines,
    DocNumber: inv.invoiceNumber,
    TxnDate: inv.issueDate,
    DueDate: inv.dueDate,
    PrivateNote: inv.notes || "",
    CustomerMemo: { value: `Placement fee — ${inv.jobTitle || "Executive Search"} for ${inv.candidateName || "candidate"}` },
    ...(inv.clientEmail ? {
      BillEmail: { Address: inv.clientEmail },
      EmailStatus: "NeedToSend",
    } : {}),
  };

  // If already in QB, update (sparse update)
  if (inv.qbInvoiceId && inv.qbSyncToken) {
    invoiceBody.Id = inv.qbInvoiceId;
    invoiceBody.SyncToken = inv.qbSyncToken;
    invoiceBody.sparse = true;
    const result = await qbPost("invoice", invoiceBody, token, realmId) as QBInvoiceResult;
    return {
      qbInvoiceId: result.Invoice.Id,
      qbSyncToken: result.Invoice.SyncToken,
      qbCustomerId: customerId,
    };
  }

  // Create new
  const result = await qbPost("invoice", invoiceBody, token, realmId) as QBInvoiceResult;
  return {
    qbInvoiceId: result.Invoice.Id,
    qbSyncToken: result.Invoice.SyncToken,
    qbCustomerId: customerId,
  };
}

// ─── Sync: pull payments from QB → update local status ───────────────────────

export async function syncFromQB(): Promise<{
  synced: number;
  paidUpdates: number;
  errors: string[];
}> {
  const auth = await getValidAccessToken();
  if (!auth) throw new Error("QuickBooks not connected");

  const { token, realmId } = auth;
  const localInvoices = await storage.getInvoices();
  const qbLinked = localInvoices.filter(i => i.qbInvoiceId);

  let synced = 0;
  let paidUpdates = 0;
  const errors: string[] = [];

  for (const inv of qbLinked) {
    try {
      const data = await qbGet(`invoice/${inv.qbInvoiceId}`, token, realmId) as QBInvoiceResult;
      const qbInv = data.Invoice;

      const now = new Date().toISOString();
      const updates: Record<string, unknown> = {
        qbSyncToken: qbInv.SyncToken,
        qbSyncedAt: now,
      };

      // Detect payment
      const isPaid = qbInv.Balance === 0 && qbInv.TotalAmt > 0;
      const wasAlreadyPaid = inv.status === "paid";

      if (isPaid && !wasAlreadyPaid) {
        updates.status = "paid";
        updates.amountPaid = qbInv.TotalAmt;
        updates.amountDue = 0;
        updates.paidDate = now.split("T")[0];
        paidUpdates++;
      } else if (!isPaid && qbInv.Balance < qbInv.TotalAmt && qbInv.Balance > 0) {
        updates.status = "partial";
        updates.amountPaid = qbInv.TotalAmt - qbInv.Balance;
        updates.amountDue = qbInv.Balance;
      }

      await storage.updateInvoice(inv.id, updates as Parameters<typeof storage.updateInvoice>[1]);
      synced++;
    } catch (err) {
      errors.push(`Invoice ${inv.invoiceNumber}: ${String(err)}`);
    }
  }

  await setSetting("qb_last_sync", new Date().toISOString());

  return { synced, paidUpdates, errors };
}

// ─── Register routes ──────────────────────────────────────────────────────────

export function registerQBRoutes(app: Express) {

  /** GET /api/qb/status — connection state */
  app.get("/api/qb/status", async (_req: Request, res: Response) => {
    const [realmId, companyName, lastSync, tokenExpiry, clientId] = await Promise.all([
      getSetting("qb_realm_id"),
      getSetting("qb_company_name"),
      getSetting("qb_last_sync"),
      getSetting("qb_token_expiry"),
      Promise.resolve(process.env.QB_CLIENT_ID || ""),
    ]);

    res.json({
      connected: !!realmId,
      companyName: companyName || null,
      realmId: realmId || null,
      lastSync: lastSync || null,
      tokenExpiry: tokenExpiry || null,
      clientIdConfigured: !!clientId,
    });
  });

  /** GET /api/qb/connect — initiate OAuth flow */
  app.get("/api/qb/connect", (_req: Request, res: Response) => {
    const { clientId, redirectUri } = getQBConfig();
    if (!clientId) {
      return res.status(400).json({ error: "QB_CLIENT_ID not configured. Add it to your environment variables." });
    }

    const state = Buffer.from(Date.now().toString()).toString("base64");
    const params = new URLSearchParams({
      client_id: clientId,
      scope: QB_SCOPES,
      redirect_uri: redirectUri,
      response_type: "code",
      state,
    });

    const authUrl = `${QB_AUTH_URL}?${params.toString()}`;
    res.json({ authUrl });
  });

  /** GET /api/qb/callback — OAuth callback */
  app.get("/api/qb/callback", async (req: Request, res: Response) => {
    const { code, realmId, error } = req.query as Record<string, string>;

    if (error) {
      return res.redirect(`/#/settings?qb_error=${encodeURIComponent(error)}`);
    }

    if (!code || !realmId) {
      return res.redirect("/#/settings?qb_error=missing_params");
    }

    try {
      const { clientId, clientSecret, redirectUri } = getQBConfig();
      const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

      const tokenResp = await fetch(QB_TOKEN_URL, {
        method: "POST",
        headers: {
          "Authorization": `Basic ${credentials}`,
          "Content-Type": "application/x-www-form-urlencoded",
          "Accept": "application/json",
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri: redirectUri,
        }).toString(),
      });

      if (!tokenResp.ok) {
        const err = await tokenResp.text();
        throw new Error(`Token exchange failed: ${err}`);
      }

      const tokens = await tokenResp.json() as {
        access_token: string;
        refresh_token: string;
        expires_in: number;
      };

      const expiry = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

      await Promise.all([
        setSetting("qb_access_token", tokens.access_token),
        setSetting("qb_refresh_token", tokens.refresh_token),
        setSetting("qb_realm_id", realmId),
        setSetting("qb_token_expiry", expiry),
      ]);

      // Fetch company name
      try {
        const companyData = await qbGet("companyinfo/" + realmId, tokens.access_token, realmId) as {
          CompanyInfo?: { CompanyName?: string }
        };
        const name = companyData.CompanyInfo?.CompanyName;
        if (name) await setSetting("qb_company_name", name);
      } catch {
        // non-fatal
      }

      res.redirect("/#/settings?qb_connected=1");
    } catch (err) {
      console.error("[QB] OAuth callback error:", err);
      res.redirect(`/#/settings?qb_error=${encodeURIComponent(String(err))}`);
    }
  });

  /** POST /api/qb/disconnect */
  app.post("/api/qb/disconnect", async (_req: Request, res: Response) => {
    try {
      const refreshToken = await getSetting("qb_refresh_token");
      if (refreshToken) {
        const { clientId, clientSecret } = getQBConfig();
        const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
        await fetch(QB_REVOKE_URL, {
          method: "POST",
          headers: {
            "Authorization": `Basic ${credentials}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({ token: refreshToken }).toString(),
        }).catch(() => {}); // fire and forget
      }

      await Promise.all([
        storage.deleteSetting("qb_access_token"),
        storage.deleteSetting("qb_refresh_token"),
        storage.deleteSetting("qb_realm_id"),
        storage.deleteSetting("qb_company_name"),
        storage.deleteSetting("qb_token_expiry"),
        storage.deleteSetting("qb_last_sync"),
      ]);

      res.json({ disconnected: true });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  /** POST /api/qb/push/:id — push single invoice to QB */
  app.post("/api/qb/push/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(String(req.params.id), 10);
      const result = await pushInvoiceToQB(id);

      await storage.updateInvoice(id, {
        qbInvoiceId: result.qbInvoiceId,
        qbSyncToken: result.qbSyncToken,
        qbCustomerId: result.qbCustomerId,
        qbSyncedAt: new Date().toISOString(),
        status: "sent",
      });

      res.json({ success: true, ...result });
    } catch (err) {
      console.error("[QB] Push error:", err);
      res.status(500).json({ error: String(err) });
    }
  });

  /** POST /api/qb/sync — pull all invoices, update paid status */
  app.post("/api/qb/sync", async (_req: Request, res: Response) => {
    try {
      const result = await syncFromQB();
      res.json(result);
    } catch (err) {
      console.error("[QB] Sync error:", err);
      res.status(500).json({ error: String(err) });
    }
  });

  /**
   * POST /api/qb/webhook — QuickBooks real-time webhook
   *
   * QB sends a signed POST when invoices/payments change. Payload:
   * { eventNotifications: [{ realmId, dataChangeEvent: { entities: [{name, id, operation}] } }] }
   *
   * Register this URL in your QB app: Settings → Webhooks → https://your-domain/api/qb/webhook
   */
  app.post("/api/qb/webhook", async (req: Request, res: Response) => {
    // QB expects 200 immediately — process async
    res.sendStatus(200);

    try {
      const payload = req.body as {
        eventNotifications?: Array<{
          realmId: string;
          dataChangeEvent: {
            entities: Array<{ name: string; id: string; operation: string }>
          }
        }>
      };

      if (!payload.eventNotifications) return;

      const auth = await getValidAccessToken();
      if (!auth) return;

      for (const notification of payload.eventNotifications) {
        for (const entity of notification.dataChangeEvent.entities) {
          // When a Payment is created, find linked invoices and mark paid
          if (entity.name === "Payment" && entity.operation === "Create") {
            try {
              const paymentData = await qbGet(`payment/${entity.id}`, auth.token, auth.realmId) as {
                Payment: {
                  Id: string;
                  Line?: Array<{ LinkedTxn?: Array<{ TxnId: string; TxnType: string }> }>
                }
              };

              const payment = paymentData.Payment;
              for (const line of payment.Line || []) {
                for (const linked of line.LinkedTxn || []) {
                  if (linked.TxnType === "Invoice") {
                    // Find local invoice by qbInvoiceId
                    const allInvoices = await storage.getInvoices();
                    const local = allInvoices.find(i => i.qbInvoiceId === linked.TxnId);
                    if (local) {
                      // Fetch QB invoice to get updated balance
                      const invData = await qbGet(`invoice/${linked.TxnId}`, auth.token, auth.realmId) as QBInvoiceResult;
                      const qbInv = invData.Invoice;
                      const isPaid = qbInv.Balance === 0;
                      await storage.updateInvoice(local.id, {
                        status: isPaid ? "paid" : "partial",
                        amountPaid: qbInv.TotalAmt - qbInv.Balance,
                        amountDue: qbInv.Balance,
                        paidDate: isPaid ? new Date().toISOString().split("T")[0] : undefined,
                        qbPaymentId: payment.Id,
                        qbSyncToken: qbInv.SyncToken,
                        qbSyncedAt: new Date().toISOString(),
                      });
                      console.log(`[QB Webhook] Invoice ${local.invoiceNumber} marked ${isPaid ? "paid" : "partial"} via webhook`);
                    }
                  }
                }
              }
            } catch (err) {
              console.error("[QB Webhook] Payment processing error:", err);
            }
          }

          // Also handle direct Invoice updates
          if (entity.name === "Invoice" && entity.operation === "Update") {
            try {
              const allInvoices = await storage.getInvoices();
              const local = allInvoices.find(i => i.qbInvoiceId === entity.id);
              if (local) {
                const invData = await qbGet(`invoice/${entity.id}`, auth.token, auth.realmId) as QBInvoiceResult;
                const qbInv = invData.Invoice;
                const isPaid = qbInv.Balance === 0;
                if (isPaid && local.status !== "paid") {
                  await storage.updateInvoice(local.id, {
                    status: "paid",
                    amountPaid: qbInv.TotalAmt,
                    amountDue: 0,
                    paidDate: new Date().toISOString().split("T")[0],
                    qbSyncToken: qbInv.SyncToken,
                    qbSyncedAt: new Date().toISOString(),
                  });
                }
              }
            } catch (err) {
              console.error("[QB Webhook] Invoice update error:", err);
            }
          }
        }
      }
    } catch (err) {
      console.error("[QB Webhook] Error:", err);
    }
  });
}
