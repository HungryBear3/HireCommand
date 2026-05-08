/**
 * LinkedIn Profile Auto-Sync Engine
 *
 * Strategy: We can't scrape LinkedIn directly (bot detection / ToS).
 * Instead we use a layered approach:
 *
 *  1. PRIMARY — Loxo API: if the candidate has a loxoId, pull their latest
 *     profile from Loxo which already mirrors LinkedIn data fields
 *     (title, company, location, headline).
 *
 *  2. SECONDARY — ProxyCurl / People Data Labs / Proxycurl API (if key is set).
 *     If QB_PROXYCURL_KEY env var is present we call ProxyCurl's LinkedIn
 *     profile endpoint for real live data.
 *
 *  3. FALLBACK — Loxo-only fields diff'd against current DB record.
 *
 * For each candidate with a linkedin URL:
 *  - Fetch fresh profile data
 *  - Diff against stored snapshot
 *  - If changes found: update candidate record, append timeline entry,
 *    store the diff in linkedinChanges
 *  - Update linkedinSyncedAt regardless
 *
 * The sync runs every 14 days via schedule_cron, and can be triggered
 * manually via POST /api/linkedin-sync/run.
 */

import type { Express } from "express";
import { storage } from "./storage";

const LOXO_BASE = "https://app.loxo.co/api";
const LOXO_SLUG = "the-hiring-advisors-1";
const LOXO_KEY  = process.env.LOXO_API_KEY || "";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ProfileSnapshot {
  title:    string;
  company:  string;
  location: string;
  email:    string;
  phone:    string;
}

export interface ProfileChange {
  field:    string;
  label:    string;
  oldValue: string;
  newValue: string;
  detectedAt: string;
}

export interface SyncResult {
  candidateId: number;
  name:        string;
  status:      "updated" | "unchanged" | "skipped" | "error";
  changes:     ProfileChange[];
  error?:      string;
}

// ─── Diff helper ─────────────────────────────────────────────────────────────

const FIELD_LABELS: Record<string, string> = {
  title:    "Job Title",
  company:  "Company",
  location: "Location",
  email:    "Email",
  phone:    "Phone",
};

function diffSnapshots(
  prev: ProfileSnapshot,
  next: ProfileSnapshot,
): ProfileChange[] {
  const changes: ProfileChange[] = [];
  const now = new Date().toISOString();
  for (const key of Object.keys(FIELD_LABELS) as (keyof ProfileSnapshot)[]) {
    const oldVal = (prev[key] ?? "").trim();
    const newVal = (next[key] ?? "").trim();
    if (oldVal && newVal && oldVal !== newVal) {
      changes.push({
        field:      key,
        label:      FIELD_LABELS[key],
        oldValue:   oldVal,
        newValue:   newVal,
        detectedAt: now,
      });
    }
  }
  return changes;
}

// ─── Loxo fetch ──────────────────────────────────────────────────────────────

async function fetchLoxoProfile(loxoId: number): Promise<ProfileSnapshot | null> {
  try {
    const res = await fetch(
      `${LOXO_BASE}/${LOXO_SLUG}/people/${loxoId}/`,
      {
        headers: {
          Authorization: `Token ${LOXO_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );
    if (!res.ok) return null;
    const data: any = await res.json();
    // Loxo person fields
    const title    = data.title || data.current_title || "";
    const company  = data.company_name || data.current_employer || "";
    const location = data.location || data.city || "";
    const email    = (data.emails && data.emails[0]?.email) || data.email || "";
    const phone    = (data.phones && data.phones[0]?.phone) || data.phone || "";
    return { title, company, location, email, phone };
  } catch {
    return null;
  }
}

// ─── ProxyCurl fetch (optional) ───────────────────────────────────────────────

async function fetchProxyCurlProfile(linkedinUrl: string): Promise<ProfileSnapshot | null> {
  const apiKey = process.env.PROXYCURL_API_KEY;
  if (!apiKey) return null;
  try {
    const url = new URL("https://nubela.co/proxycurl/api/v2/linkedin");
    url.searchParams.set("url", linkedinUrl);
    url.searchParams.set("use_cache", "if-present");
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) return null;
    const data: any = await res.json();
    return {
      title:    data.headline || data.occupation || "",
      company:  (data.experiences && data.experiences[0]?.company) || "",
      location: data.city || data.country_full_name || "",
      email:    (data.personal_emails && data.personal_emails[0]) || "",
      phone:    (data.personal_numbers && data.personal_numbers[0]) || "",
    };
  } catch {
    return null;
  }
}

// ─── Sync single candidate ───────────────────────────────────────────────────

async function syncCandidate(candidateId: number): Promise<SyncResult> {
  const candidate = await storage.getCandidate(candidateId);
  if (!candidate) {
    return { candidateId, name: "unknown", status: "error", changes: [], error: "Not found" };
  }

  // Skip if no LinkedIn URL stored
  if (!candidate.linkedin || candidate.linkedin.trim() === "") {
    return { candidateId, name: candidate.name, status: "skipped", changes: [] };
  }

  let freshProfile: ProfileSnapshot | null = null;

  // 1. Try ProxyCurl first (most accurate, real-time LinkedIn)
  freshProfile = await fetchProxyCurlProfile(candidate.linkedin);

  // 2. Fall back to Loxo if we have a loxoId
  if (!freshProfile && candidate.loxoId) {
    freshProfile = await fetchLoxoProfile(candidate.loxoId);
  }

  // 3. Nothing we can do — record as skipped but still update syncedAt
  if (!freshProfile) {
    await storage.updateCandidate(candidateId, {
      linkedinSyncedAt: new Date().toISOString(),
      linkedinSyncError: "No data source available (add PROXYCURL_API_KEY for live LinkedIn data)",
    } as any);
    return {
      candidateId,
      name: candidate.name,
      status: "skipped",
      changes: [],
      error: "No data source — add PROXYCURL_API_KEY env var for live LinkedIn sync",
    };
  }

  // Build previous snapshot from DB record or stored snapshot
  let prevSnapshot: ProfileSnapshot;
  try {
    prevSnapshot = candidate.linkedinSnapshot
      ? JSON.parse(candidate.linkedinSnapshot)
      : { title: candidate.title, company: candidate.company, location: candidate.location, email: candidate.email, phone: candidate.phone };
  } catch {
    prevSnapshot = { title: candidate.title, company: candidate.company, location: candidate.location, email: candidate.email, phone: candidate.phone };
  }

  const changes = diffSnapshots(prevSnapshot, freshProfile);

  // Load existing accumulated changes (keep history of past changes)
  let accumulatedChanges: ProfileChange[] = [];
  try {
    if (candidate.linkedinChanges) {
      accumulatedChanges = JSON.parse(candidate.linkedinChanges);
    }
  } catch { /* ignore */ }

  // Merge new changes into history (most recent first, deduplicate by field+date)
  const allChanges = [...changes, ...accumulatedChanges].slice(0, 50); // cap at 50 history entries

  const now = new Date().toISOString();
  const nowDate = now.slice(0, 10);

  if (changes.length > 0) {
    // Build a timeline entry describing what changed
    const changeDesc = changes
      .map(c => `${c.label}: "${c.oldValue}" → "${c.newValue}"`)
      .join("; ");

    // Update candidate fields that changed + sync metadata
    const patch: Record<string, any> = {
      linkedinSyncedAt:   now,
      linkedinSnapshot:   JSON.stringify(freshProfile),
      linkedinChanges:    JSON.stringify(allChanges),
      linkedinSyncError:  null,
    };

    // Apply actual field changes to the candidate record
    if (changes.find(c => c.field === "title"))    patch.title    = freshProfile.title;
    if (changes.find(c => c.field === "company"))  patch.company  = freshProfile.company;
    if (changes.find(c => c.field === "location")) patch.location = freshProfile.location;
    if (changes.find(c => c.field === "email") && freshProfile.email)   patch.email = freshProfile.email;
    if (changes.find(c => c.field === "phone") && freshProfile.phone)   patch.phone = freshProfile.phone;

    // Append a timeline event
    let timeline: { date: string; event: string }[] = [];
    try { timeline = JSON.parse(candidate.timeline); } catch { /* */ }
    timeline.unshift({ date: nowDate, event: `LinkedIn profile updated: ${changeDesc}` });
    patch.timeline = JSON.stringify(timeline);

    await storage.updateCandidate(candidateId, patch as any);

    return { candidateId, name: candidate.name, status: "updated", changes };
  } else {
    // No changes — just update the sync timestamp and refresh snapshot
    await storage.updateCandidate(candidateId, {
      linkedinSyncedAt:  now,
      linkedinSnapshot:  JSON.stringify(freshProfile),
      linkedinSyncError: null,
    } as any);
    return { candidateId, name: candidate.name, status: "unchanged", changes: [] };
  }
}

// ─── Bulk sync all candidates ────────────────────────────────────────────────

export async function syncAllLinkedInProfiles(): Promise<{
  total: number;
  updated: number;
  unchanged: number;
  skipped: number;
  errors: number;
  results: SyncResult[];
}> {
  console.log("[LinkedIn Sync] Starting bulk profile sync…");
  const candidates = await storage.getCandidates();
  const eligible   = candidates.filter(c => c.linkedin && c.linkedin.trim() !== "");

  console.log(`[LinkedIn Sync] ${eligible.length} candidates with LinkedIn URLs`);

  const results: SyncResult[] = [];

  // Process in batches of 5 to avoid hammering APIs
  const BATCH = 5;
  for (let i = 0; i < eligible.length; i += BATCH) {
    const batch = eligible.slice(i, i + BATCH);
    const batchResults = await Promise.all(batch.map(c => syncCandidate(c.id)));
    results.push(...batchResults);

    // Small delay between batches
    if (i + BATCH < eligible.length) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  const summary = {
    total:     results.length,
    updated:   results.filter(r => r.status === "updated").length,
    unchanged: results.filter(r => r.status === "unchanged").length,
    skipped:   results.filter(r => r.status === "skipped").length,
    errors:    results.filter(r => r.status === "error").length,
    results,
  };

  console.log(`[LinkedIn Sync] Complete — updated: ${summary.updated}, unchanged: ${summary.unchanged}, skipped: ${summary.skipped}, errors: ${summary.errors}`);

  // Store last sync timestamp
  await storage.setSetting("linkedin_last_sync", new Date().toISOString());
  await storage.setSetting("linkedin_last_sync_summary", JSON.stringify({
    total:     summary.total,
    updated:   summary.updated,
    unchanged: summary.unchanged,
    skipped:   summary.skipped,
    errors:    summary.errors,
    ranAt:     new Date().toISOString(),
  }));

  return summary;
}

// ─── Express routes ───────────────────────────────────────────────────────────

export function registerLinkedInSyncRoutes(app: Express) {

  // GET /api/linkedin-sync/status — last sync timestamp + summary
  app.get("/api/linkedin-sync/status", async (_req, res) => {
    try {
      const lastSync    = await storage.getSetting("linkedin_last_sync");
      const summaryRaw  = await storage.getSetting("linkedin_last_sync_summary");
      const summary     = summaryRaw ? JSON.parse(summaryRaw) : null;

      // Count candidates with/without LinkedIn URLs
      const all         = await storage.getCandidates();
      const withLinkedIn  = all.filter(c => c.linkedin && c.linkedin.trim() !== "").length;
      const neverSynced   = all.filter(c => c.linkedin && c.linkedin.trim() !== "" && !c.linkedinSyncedAt).length;
      const recentChanges = all.filter(c => {
        if (!c.linkedinChanges) return false;
        try {
          const ch: ProfileChange[] = JSON.parse(c.linkedinChanges);
          return ch.length > 0;
        } catch { return false; }
      }).length;

      res.json({
        lastSync:         lastSync ?? null,
        nextSync:         lastSync ? new Date(new Date(lastSync).getTime() + 14 * 24 * 60 * 60 * 1000).toISOString() : null,
        summary,
        stats: {
          totalCandidates:  all.length,
          withLinkedIn,
          neverSynced,
          recentChanges,
          hasProxyCurl:     !!process.env.PROXYCURL_API_KEY,
        },
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/linkedin-sync/run — trigger full sync manually
  app.post("/api/linkedin-sync/run", async (_req, res) => {
    try {
      // Run async — respond immediately, sync happens in background
      res.json({ message: "LinkedIn profile sync started", startedAt: new Date().toISOString() });
      // Fire and forget — results stored in DB
      syncAllLinkedInProfiles().catch(err => {
        console.error("[LinkedIn Sync] Error during manual sync:", err);
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/linkedin-sync/candidate/:id — sync a single candidate now
  app.post("/api/linkedin-sync/candidate/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid candidate ID" });
      const result = await syncCandidate(id);
      // Return fresh candidate record so UI can update immediately
      const updated = await storage.getCandidate(id);
      res.json({ result, candidate: updated });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/linkedin-sync/changes — list all candidates with recent changes
  app.get("/api/linkedin-sync/changes", async (_req, res) => {
    try {
      const all = await storage.getCandidates();
      const withChanges = all
        .filter(c => {
          if (!c.linkedinChanges) return false;
          try { return JSON.parse(c.linkedinChanges).length > 0; }
          catch { return false; }
        })
        .map(c => ({
          id:             c.id,
          name:           c.name,
          title:          c.title,
          company:        c.company,
          linkedin:       c.linkedin,
          linkedinSyncedAt: c.linkedinSyncedAt,
          changes:        JSON.parse(c.linkedinChanges!),
        }));
      res.json(withChanges);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });
}

// ─── Startup check ────────────────────────────────────────────────────────────
// Called once on server boot — if last sync was >14 days ago (or never),
// kick off a background sync automatically.

export async function checkAndRunStartupSync() {
  try {
    const lastSync = await storage.getSetting("linkedin_last_sync");
    if (!lastSync) {
      console.log("[LinkedIn Sync] No previous sync found — scheduling initial sync in 30s…");
      setTimeout(() => {
        syncAllLinkedInProfiles().catch(err =>
          console.error("[LinkedIn Sync] Startup sync failed:", err)
        );
      }, 30_000);
      return;
    }

    const daysSince = (Date.now() - new Date(lastSync).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince >= 14) {
      console.log(`[LinkedIn Sync] Last sync was ${daysSince.toFixed(1)} days ago — running overdue sync in 30s…`);
      setTimeout(() => {
        syncAllLinkedInProfiles().catch(err =>
          console.error("[LinkedIn Sync] Startup sync failed:", err)
        );
      }, 30_000);
    } else {
      console.log(`[LinkedIn Sync] Last sync was ${daysSince.toFixed(1)} days ago — next sync in ${(14 - daysSince).toFixed(1)} days`);
    }
  } catch (err) {
    console.error("[LinkedIn Sync] Startup check failed:", err);
  }
}
