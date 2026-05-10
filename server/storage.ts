import {
  type User, type InsertUser, users,
  type Candidate, type InsertCandidate, candidates,
  type Job, type InsertJob, jobs,
  type LoxoCompany, type InsertLoxoCompany, loxoCompanies,
  type LoxoClient, type InsertLoxoClient, loxoClients,
  type CandidateJobAssignment, type InsertCandidateJobAssignment, candidateJobAssignments,
  type Opportunity, type InsertOpportunity, opportunities,
  type Campaign, type InsertCampaign, campaigns,
  type Activity, type InsertActivity, activities,
  type Interview, type InsertInterview, interviews,
  type Placement, type InsertPlacement, placements,
  type CommissionSplit, type InsertCommissionSplit, commissionSplits,
  type Invoice, type InsertInvoice, invoices,
  settings,
} from "@shared/schema";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { and, eq, desc, sql } from "drizzle-orm";
if (!process.env.DATABASE_URL) {
  console.error("[storage] WARNING: DATABASE_URL not set — DB calls will fail");
}

// dns.setDefaultResultOrder('ipv4first') is set in index.ts at process start.
// Do NOT replace the hostname with a raw IP — Supabase's session pooler uses
// SNI (Server Name Indication) for tenant routing, which breaks if the hostname
// is swapped for an IP address. Let Node.js resolve the hostname to IPv4 naturally.
const connectionURL = process.env.DATABASE_URL || "postgresql://localhost/hirecommand";

const client = postgres(connectionURL, {
  max: 10,
  connect_timeout: 15,
  idle_timeout: 30,
  ssl: { rejectUnauthorized: false },
  onnotice: () => {},
});
export const db = drizzle(client);

async function ensureRuntimeSchema() {
  if (!process.env.DATABASE_URL) return;
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS candidate_job_assignments (
      id serial PRIMARY KEY,
      candidate_id integer NOT NULL,
      job_id integer NOT NULL,
      status text NOT NULL DEFAULT 'submitted',
      notes text NOT NULL DEFAULT '',
      created_at text NOT NULL,
      updated_at text NOT NULL,
      UNIQUE(candidate_id, job_id)
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS loxo_companies (
      id serial PRIMARY KEY,
      loxo_id integer UNIQUE,
      name text NOT NULL,
      website text NOT NULL DEFAULT '',
      location text NOT NULL DEFAULT '',
      industry text NOT NULL DEFAULT '',
      owner_name text NOT NULL DEFAULT '',
      raw_json text NOT NULL DEFAULT '{}',
      synced_at text NOT NULL
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS loxo_clients (
      id serial PRIMARY KEY,
      loxo_id integer UNIQUE,
      name text NOT NULL,
      company text NOT NULL DEFAULT '',
      title text NOT NULL DEFAULT '',
      email text NOT NULL DEFAULT '',
      phone text NOT NULL DEFAULT '',
      location text NOT NULL DEFAULT '',
      raw_json text NOT NULL DEFAULT '{}',
      synced_at text NOT NULL
    )
  `);
}

ensureRuntimeSchema().catch((err) => console.error("[schema] Failed to ensure runtime schema:", err.message));

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  updateUser(id: number, data: Partial<InsertUser>): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getCandidates(): Promise<Candidate[]>;
  getCandidate(id: number): Promise<Candidate | undefined>;
  createCandidate(c: InsertCandidate): Promise<Candidate>;
  updateCandidate(id: number, c: Partial<InsertCandidate>): Promise<Candidate | undefined>;
  deleteCandidate(id: number): Promise<void>;
  getCandidateJobs(candidateId: number): Promise<Job[]>;
  addCandidateToJob(candidateId: number, jobId: number): Promise<CandidateJobAssignment>;
  removeCandidateFromJob(candidateId: number, jobId: number): Promise<void>;
  getJobs(): Promise<Job[]>;
  getJob(id: number): Promise<Job | undefined>;
  createJob(j: InsertJob): Promise<Job>;
  updateJob(id: number, j: Partial<InsertJob>): Promise<Job | undefined>;
  deleteJob(id: number): Promise<void>;
  getOpportunities(): Promise<Opportunity[]>;
  getOpportunity(id: number): Promise<Opportunity | undefined>;
  createOpportunity(o: InsertOpportunity): Promise<Opportunity>;
  updateOpportunity(id: number, o: Partial<InsertOpportunity>): Promise<Opportunity | undefined>;
  deleteOpportunity(id: number): Promise<void>;
  getCampaigns(): Promise<Campaign[]>;
  getCampaign(id: number): Promise<Campaign | undefined>;
  createCampaign(c: InsertCampaign): Promise<Campaign>;
  updateCampaign(id: number, c: Partial<InsertCampaign>): Promise<Campaign | undefined>;
  deleteCampaign(id: number): Promise<void>;
  getActivities(): Promise<Activity[]>;
  createActivity(a: InsertActivity): Promise<Activity>;
  getInterviews(): Promise<Interview[]>;
  getInterview(id: number): Promise<Interview | undefined>;
  createInterview(i: InsertInterview): Promise<Interview>;
  updateInterview(id: number, i: Partial<InsertInterview>): Promise<Interview | undefined>;
  deleteInterview(id: number): Promise<void>;
  // Loxo sync helpers
  getCandidateByLoxoId(loxoId: number): Promise<Candidate | undefined>;
  getJobByLoxoId(loxoId: number): Promise<Job | undefined>;
  upsertCandidateFromLoxo(c: InsertCandidate & { loxoId: number }): Promise<Candidate>;
  upsertJobFromLoxo(j: InsertJob & { loxoId: number }): Promise<Job>;
  closeMissingLoxoJobs(activeLoxoIds: number[]): Promise<number>;
  getLoxoCompanies(): Promise<LoxoCompany[]>;
  upsertLoxoCompany(c: InsertLoxoCompany & { loxoId: number }): Promise<LoxoCompany>;
  getLoxoClients(): Promise<LoxoClient[]>;
  upsertLoxoClient(c: InsertLoxoClient & { loxoId: number }): Promise<LoxoClient>;
  // Placements
  getPlacements(): Promise<Placement[]>;
  getPlacement(id: number): Promise<Placement | undefined>;
  createPlacement(p: InsertPlacement): Promise<Placement>;
  updatePlacement(id: number, p: Partial<InsertPlacement>): Promise<Placement | undefined>;
  deletePlacement(id: number): Promise<void>;
  // Commission splits
  getSplitsForPlacement(placementId: number): Promise<CommissionSplit[]>;
  getSplitsForEmployee(employee: string): Promise<CommissionSplit[]>;
  upsertSplitsForPlacement(placementId: number, splits: InsertCommissionSplit[]): Promise<CommissionSplit[]>;
  // Invoices
  getInvoices(): Promise<Invoice[]>;
  getInvoice(id: number): Promise<Invoice | undefined>;
  createInvoice(inv: InsertInvoice): Promise<Invoice>;
  updateInvoice(id: number, inv: Partial<InsertInvoice>): Promise<Invoice | undefined>;
  deleteInvoice(id: number): Promise<void>;
  // Settings (key-value)
  getSetting(key: string): Promise<string | undefined>;
  setSetting(key: string, value: string): Promise<void>;
  deleteSetting(key: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number) {
    const rows = await db.select().from(users).where(eq(users.id, id));
    return rows[0];
  }
  async getUserByUsername(username: string) {
    const rows = await db.select().from(users).where(eq(users.username, username));
    return rows[0];
  }
  async getUserByEmail(email: string) {
    const rows = await db.select().from(users).where(eq(users.email, email));
    return rows[0];
  }
  async getAllUsers() {
    return db.select().from(users);
  }
  async updateUser(id: number, data: Partial<InsertUser>) {
    const rows = await db.update(users).set(data).where(eq(users.id, id)).returning();
    return rows[0];
  }
  async createUser(u: InsertUser) {
    const rows = await db.insert(users).values(u).returning();
    return rows[0];
  }

  async getCandidates() {
    return db.select().from(candidates);
  }
  async getCandidate(id: number) {
    const rows = await db.select().from(candidates).where(eq(candidates.id, id));
    return rows[0];
  }
  async createCandidate(c: InsertCandidate) {
    const rows = await db.insert(candidates).values(c).returning();
    return rows[0];
  }
  async updateCandidate(id: number, c: Partial<InsertCandidate>) {
    const rows = await db.update(candidates).set(c).where(eq(candidates.id, id)).returning();
    return rows[0];
  }
  async deleteCandidate(id: number) {
    await db.delete(candidates).where(eq(candidates.id, id));
  }

  async getCandidateJobs(candidateId: number) {
    const rows = await db
      .select({ job: jobs })
      .from(candidateJobAssignments)
      .innerJoin(jobs, eq(candidateJobAssignments.jobId, jobs.id))
      .where(eq(candidateJobAssignments.candidateId, candidateId));
    return rows.map((row) => row.job);
  }
  async addCandidateToJob(candidateId: number, jobId: number) {
    const now = new Date().toISOString();
    const existing = await db
      .select()
      .from(candidateJobAssignments)
      .where(and(eq(candidateJobAssignments.candidateId, candidateId), eq(candidateJobAssignments.jobId, jobId)));
    if (existing[0]) return existing[0];

    const assignment: InsertCandidateJobAssignment = {
      candidateId,
      jobId,
      status: "submitted",
      notes: "",
      createdAt: now,
      updatedAt: now,
    };
    const rows = await db.insert(candidateJobAssignments).values(assignment).returning();
    await db.update(jobs).set({ candidateCount: sql`${jobs.candidateCount} + 1` as any }).where(eq(jobs.id, jobId));
    return rows[0];
  }
  async removeCandidateFromJob(candidateId: number, jobId: number) {
    await db
      .delete(candidateJobAssignments)
      .where(and(eq(candidateJobAssignments.candidateId, candidateId), eq(candidateJobAssignments.jobId, jobId)));
    await db.update(jobs).set({ candidateCount: sql`greatest(${jobs.candidateCount} - 1, 0)` as any }).where(eq(jobs.id, jobId));
  }

  async getJobs() {
    return db.select().from(jobs);
  }
  async getJob(id: number) {
    const rows = await db.select().from(jobs).where(eq(jobs.id, id));
    return rows[0];
  }
  async createJob(j: InsertJob) {
    const rows = await db.insert(jobs).values(j).returning();
    return rows[0];
  }
  async updateJob(id: number, j: Partial<InsertJob>) {
    const rows = await db.update(jobs).set(j).where(eq(jobs.id, id)).returning();
    return rows[0];
  }
  async deleteJob(id: number) {
    await db.delete(jobs).where(eq(jobs.id, id));
  }

  async getOpportunities() {
    return db.select().from(opportunities);
  }
  async getOpportunity(id: number) {
    const rows = await db.select().from(opportunities).where(eq(opportunities.id, id));
    return rows[0];
  }
  async createOpportunity(o: InsertOpportunity) {
    const rows = await db.insert(opportunities).values(o).returning();
    return rows[0];
  }
  async updateOpportunity(id: number, o: Partial<InsertOpportunity>) {
    const rows = await db.update(opportunities).set(o).where(eq(opportunities.id, id)).returning();
    return rows[0];
  }
  async deleteOpportunity(id: number) {
    await db.delete(opportunities).where(eq(opportunities.id, id));
  }

  async getCampaigns() {
    return db.select().from(campaigns);
  }
  async getCampaign(id: number) {
    const rows = await db.select().from(campaigns).where(eq(campaigns.id, id));
    return rows[0];
  }
  async createCampaign(c: InsertCampaign) {
    const rows = await db.insert(campaigns).values(c).returning();
    return rows[0];
  }
  async updateCampaign(id: number, c: Partial<InsertCampaign>) {
    const rows = await db.update(campaigns).set(c).where(eq(campaigns.id, id)).returning();
    return rows[0];
  }
  async deleteCampaign(id: number) {
    await db.delete(campaigns).where(eq(campaigns.id, id));
  }

  async getActivities() {
    return db.select().from(activities);
  }
  async createActivity(a: InsertActivity) {
    const rows = await db.insert(activities).values(a).returning();
    return rows[0];
  }

  async getInterviews() {
    return db.select().from(interviews);
  }
  async getInterview(id: number) {
    const rows = await db.select().from(interviews).where(eq(interviews.id, id));
    return rows[0];
  }
  async createInterview(i: InsertInterview) {
    const rows = await db.insert(interviews).values(i).returning();
    return rows[0];
  }
  async updateInterview(id: number, i: Partial<InsertInterview>) {
    const rows = await db.update(interviews).set(i).where(eq(interviews.id, id)).returning();
    return rows[0];
  }
  async deleteInterview(id: number) {
    await db.delete(interviews).where(eq(interviews.id, id));
  }

  // ── Loxo sync helpers ─────────────────────────────────────────────────────
  async getCandidateByLoxoId(loxoId: number) {
    const rows = await db.select().from(candidates).where(eq(candidates.loxoId, loxoId));
    return rows[0];
  }
  async getJobByLoxoId(loxoId: number) {
    const rows = await db.select().from(jobs).where(eq(jobs.loxoId, loxoId));
    return rows[0];
  }
  async upsertCandidateFromLoxo(c: InsertCandidate & { loxoId: number }) {
    const existing = await this.getCandidateByLoxoId(c.loxoId);
    if (existing) {
      const rows = await db.update(candidates).set(c).where(eq(candidates.loxoId, c.loxoId)).returning();
      return rows[0];
    }
    const rows = await db.insert(candidates).values(c).returning();
    return rows[0];
  }
  async upsertJobFromLoxo(j: InsertJob & { loxoId: number }) {
    const existing = await this.getJobByLoxoId(j.loxoId);
    if (existing) {
      const rows = await db.update(jobs).set(j).where(eq(jobs.loxoId, j.loxoId)).returning();
      return rows[0];
    }
    const rows = await db.insert(jobs).values(j).returning();
    return rows[0];
  }
  async closeMissingLoxoJobs(activeLoxoIds: number[]) {
    if (activeLoxoIds.length === 0) return 0;
    const result: any = await db.execute(sql`
      UPDATE jobs
      SET stage = 'closed'
      WHERE loxo_id IS NOT NULL
        AND stage <> 'closed'
        AND NOT (loxo_id = ANY(${activeLoxoIds}::int[]))
    `);
    return result.count ?? 0;
  }
  async getLoxoCompanies() {
    return db.select().from(loxoCompanies).orderBy(loxoCompanies.name);
  }
  async upsertLoxoCompany(c: InsertLoxoCompany & { loxoId: number }) {
    const existing = (await db.select().from(loxoCompanies).where(eq(loxoCompanies.loxoId, c.loxoId)))[0];
    if (existing) {
      const rows = await db.update(loxoCompanies).set(c).where(eq(loxoCompanies.loxoId, c.loxoId)).returning();
      return rows[0];
    }
    const rows = await db.insert(loxoCompanies).values(c).returning();
    return rows[0];
  }
  async getLoxoClients() {
    return db.select().from(loxoClients).orderBy(loxoClients.name);
  }
  async upsertLoxoClient(c: InsertLoxoClient & { loxoId: number }) {
    const existing = (await db.select().from(loxoClients).where(eq(loxoClients.loxoId, c.loxoId)))[0];
    if (existing) {
      const rows = await db.update(loxoClients).set(c).where(eq(loxoClients.loxoId, c.loxoId)).returning();
      return rows[0];
    }
    const rows = await db.insert(loxoClients).values(c).returning();
    return rows[0];
  }

  // ── Placements ────────────────────────────────────────────────────────────
  async getPlacements() {
    return db.select().from(placements);
  }
  async getPlacement(id: number) {
    const rows = await db.select().from(placements).where(eq(placements.id, id));
    return rows[0];
  }
  async createPlacement(p: InsertPlacement) {
    const rows = await db.insert(placements).values(p).returning();
    return rows[0];
  }
  async updatePlacement(id: number, p: Partial<InsertPlacement>) {
    const rows = await db.update(placements).set(p).where(eq(placements.id, id)).returning();
    return rows[0];
  }
  async deletePlacement(id: number) {
    await db.delete(placements).where(eq(placements.id, id));
  }

  // ── Commission splits ─────────────────────────────────────────────────────
  async getSplitsForPlacement(placementId: number) {
    return db.select().from(commissionSplits).where(eq(commissionSplits.placementId, placementId));
  }
  async getSplitsForEmployee(employee: string) {
    return db.select().from(commissionSplits).where(eq(commissionSplits.employee, employee));
  }
  async upsertSplitsForPlacement(placementId: number, splits: InsertCommissionSplit[]) {
    // Delete existing splits for this placement, then re-insert
    await db.delete(commissionSplits).where(eq(commissionSplits.placementId, placementId));
    if (splits.length === 0) return [];
    const rows = await db
      .insert(commissionSplits)
      .values(splits.map(s => ({ ...s, placementId })))
      .returning();
    return rows;
  }

  // ── Invoices ──────────────────────────────────────────────────────────────
  async getInvoices() {
    // newest first
    const rows = await db.select().from(invoices).orderBy(desc(invoices.id));
    return rows;
  }
  async getInvoice(id: number) {
    const rows = await db.select().from(invoices).where(eq(invoices.id, id));
    return rows[0];
  }
  async createInvoice(inv: InsertInvoice) {
    const rows = await db.insert(invoices).values(inv).returning();
    return rows[0];
  }
  async updateInvoice(id: number, inv: Partial<InsertInvoice>) {
    const existing = await this.getInvoice(id);
    if (!existing) return undefined;
    const rows = await db
      .update(invoices)
      .set({ ...inv, updatedAt: new Date().toISOString() })
      .where(eq(invoices.id, id))
      .returning();
    return rows[0];
  }
  async deleteInvoice(id: number) {
    await db.delete(invoices).where(eq(invoices.id, id));
  }

  // ── Settings ──────────────────────────────────────────────────────────────
  async getSetting(key: string) {
    const rows = await db.select().from(settings).where(eq(settings.key, key));
    return rows[0]?.value;
  }
  async setSetting(key: string, value: string) {
    const existing = await this.getSetting(key);
    if (existing !== undefined) {
      await db.update(settings).set({ value }).where(eq(settings.key, key));
    } else {
      await db.insert(settings).values({ key, value });
    }
  }
  async deleteSetting(key: string) {
    await db.delete(settings).where(eq(settings.key, key));
  }
}

export const storage = new DatabaseStorage();

// Seed data (runs only when DB is empty)
async function seed() {
  const existingCandidates = await db.select().from(candidates);
  if (existingCandidates.length > 0) return;

  // Candidates - Multi-function C-Suite and Senior Executives
  const candidateData: InsertCandidate[] = [
    // === CFO / VP Finance ===
    { name: "Sarah Chen", title: "CFO", company: "Meridian Health Partners (PE-backed)", location: "New York, NY", email: "s.chen@meridianhealth.com", phone: "(212) 555-0147", linkedin: "linkedin.com/in/sarachen-cfo", matchScore: 96, status: "interview", lastContact: "2025-01-14", tags: JSON.stringify(["Healthcare", "PE Experience", "IPO Prep", "$500M+ Revenue"]), notes: "Strong cultural fit. Led $200M debt refinancing at Meridian. Previously at Deloitte advisory.", timeline: JSON.stringify([{date: "2025-01-14", event: "Second interview with CEO"}, {date: "2025-01-10", event: "Submitted references"}, {date: "2025-01-03", event: "First interview"}, {date: "2024-12-20", event: "Initial outreach — responded same day"}]) },
    { name: "Jennifer Park", title: "CFO", company: "Summit Capital Portfolio Co", location: "Chicago, IL", email: "jpark@summitcap.com", phone: "(312) 555-0518", linkedin: "linkedin.com/in/jenniferparkCFO", matchScore: 94, status: "offer", lastContact: "2025-01-15", tags: JSON.stringify(["PE-backed", "Manufacturing", "Turnaround", "Cost Optimization"]), notes: "Offer extended at $425K base + equity. Waiting on decision by Friday.", timeline: JSON.stringify([{date: "2025-01-15", event: "Offer extended — $425K + equity"}, {date: "2025-01-10", event: "Final round with PE partners"}, {date: "2025-01-05", event: "Second interview"}, {date: "2024-12-18", event: "First interview"}]) },
    { name: "Patricia Huang", title: "CFO", company: "Vanguard Industrial Solutions", location: "Houston, TX", email: "phuang@vanguardind.com", phone: "(713) 555-0129", linkedin: "linkedin.com/in/patriciahuang", matchScore: 93, status: "interview", lastContact: "2025-01-15", tags: JSON.stringify(["Industrial", "PE-backed", "Carve-out", "Working Capital"]), notes: "Exceptional carve-out experience. Led 3 successful PE exits in manufacturing.", timeline: JSON.stringify([{date: "2025-01-15", event: "Interview with board member"}, {date: "2025-01-08", event: "Initial screen — highly impressed"}, {date: "2025-01-02", event: "Referred by PE partner"}]) },
    { name: "Rachel Morrison", title: "CFO", company: "Granite Peak Energy (Warburg portfolio)", location: "Dallas, TX", email: "rmorrison@granitepeak.com", phone: "(214) 555-0741", linkedin: "linkedin.com/in/rachelmorrison-cfo", matchScore: 95, status: "screening", lastContact: "2025-01-14", tags: JSON.stringify(["Energy", "PE-backed", "Infrastructure", "Capital Allocation"]), notes: "Top-tier candidate. Led $1.2B capital project at Granite Peak. Warburg loves her.", timeline: JSON.stringify([{date: "2025-01-14", event: "Screening call — outstanding"}, {date: "2025-01-10", event: "Warm intro from Warburg partner"}]) },
    // === CTO / VP Engineering ===
    { name: "Alex Rivera", title: "CTO", company: "DataPulse Analytics (Insight Partners)", location: "San Francisco, CA", email: "arivera@datapulse.io", phone: "(415) 555-0832", linkedin: "linkedin.com/in/alexrivera-cto", matchScore: 93, status: "interview", lastContact: "2025-01-15", tags: JSON.stringify(["Cloud Infrastructure", "AI/ML", "Platform Architecture", "PE-backed"]), notes: "Built DataPulse platform from 0 to 50M MAU. Ex-Google Staff Engineer. Deep AI expertise.", timeline: JSON.stringify([{date: "2025-01-15", event: "Technical deep-dive with CTO committee"}, {date: "2025-01-10", event: "First interview — exceptional"}, {date: "2025-01-05", event: "Sourced via PE tech network"}]) },
    { name: "Priya Nair", title: "VP Engineering", company: "Sentinel AI (a16z portfolio)", location: "Seattle, WA", email: "pnair@sentinelai.com", phone: "(206) 555-0394", linkedin: "linkedin.com/in/priyanair-eng", matchScore: 88, status: "screening", lastContact: "2025-01-13", tags: JSON.stringify(["ML Engineering", "Team Scaling", "DevOps", "Series D"]), notes: "Scaled engineering from 15 to 120. Strong ML infrastructure background from AWS.", timeline: JSON.stringify([{date: "2025-01-13", event: "Phone screen — strong technical depth"}, {date: "2025-01-08", event: "Referral from portfolio CTO"}]) },
    { name: "James Liu", title: "CTO", company: "FinEdge Payments (General Atlantic)", location: "New York, NY", email: "jliu@finedge.com", phone: "(212) 555-0671", linkedin: "linkedin.com/in/jamesliu-cto", matchScore: 91, status: "contacted", lastContact: "2025-01-12", tags: JSON.stringify(["Fintech", "Payments Infrastructure", "SOC2/PCI", "Microservices"]), notes: "Led FinEdge through SOC2 certification while tripling transaction volume. Ex-Stripe.", timeline: JSON.stringify([{date: "2025-01-12", event: "LinkedIn outreach — responded positively"}, {date: "2025-01-09", event: "Identified via fintech network"}]) },
    // === COO / VP Operations ===
    { name: "Marcus Williams", title: "COO", company: "HealthBridge Solutions (Bain Capital)", location: "Boston, MA", email: "mwilliams@healthbridge.com", phone: "(617) 555-0483", linkedin: "linkedin.com/in/marcuswilliams-coo", matchScore: 91, status: "interview", lastContact: "2025-01-14", tags: JSON.stringify(["Healthcare Ops", "PE Value Creation", "Process Optimization", "Multi-site"]), notes: "Drove 35% EBITDA improvement across 40 clinic locations. McKinsey background.", timeline: JSON.stringify([{date: "2025-01-14", event: "Second interview with PE operating partner"}, {date: "2025-01-08", event: "First interview — very impressive"}, {date: "2025-01-03", event: "Warm intro from Bain talent team"}]) },
    { name: "Elena Vasquez", title: "VP Operations", company: "LogiCore Supply Chain (Advent International)", location: "Dallas, TX", email: "evasquez@logicore.com", phone: "(214) 555-0295", linkedin: "linkedin.com/in/elenavasquez-ops", matchScore: 86, status: "sourced", lastContact: "2025-01-11", tags: JSON.stringify(["Supply Chain", "Lean Manufacturing", "ERP Implementation", "Carve-out"]), notes: "Managed $500M supply chain network. Led successful SAP implementation across 8 facilities.", timeline: JSON.stringify([{date: "2025-01-11", event: "Added to pipeline from logistics conference"}]) },
    { name: "Derek Thompson", title: "COO", company: "Apex Dental Partners (KKR)", location: "Nashville, TN", email: "dthompson@apexdental.com", phone: "(615) 555-0847", linkedin: "linkedin.com/in/derekthompson-coo", matchScore: 89, status: "contacted", lastContact: "2025-01-13", tags: JSON.stringify(["Multi-site Healthcare", "M&A Integration", "Operational Playbook", "PE-backed"]), notes: "Integrated 25 dental practice acquisitions in 18 months. Expert at PE roll-up operations.", timeline: JSON.stringify([{date: "2025-01-13", event: "Email outreach — interested in exploring"}, {date: "2025-01-10", event: "Sourced via healthcare PE network"}]) },
    // === CHRO / VP People ===
    { name: "Diana Foster", title: "CHRO", company: "TalentForge (Vista Equity)", location: "Chicago, IL", email: "dfoster@talentforge.io", phone: "(312) 555-0156", linkedin: "linkedin.com/in/dianafoster-chro", matchScore: 90, status: "screening", lastContact: "2025-01-14", tags: JSON.stringify(["PE Talent Strategy", "M&A Integration", "Comp Design", "Culture Transformation"]), notes: "Redesigned comp and equity structure across Vista's entire portfolio playbook. SHRM board member.", timeline: JSON.stringify([{date: "2025-01-14", event: "Phone screen — outstanding cultural perspective"}, {date: "2025-01-09", event: "Reached out — very interested"}]) },
    { name: "Ryan Mitchell", title: "VP People", company: "CloudReach SaaS (Thoma Bravo)", location: "Denver, CO", email: "rmitchell@cloudreach.com", phone: "(720) 555-0538", linkedin: "linkedin.com/in/ryanmitchell-people", matchScore: 84, status: "sourced", lastContact: "2025-01-10", tags: JSON.stringify(["Tech Recruiting", "HRIS", "Remote Culture", "Hypergrowth"]), notes: "Scaled CloudReach from 80 to 400 employees in 2 years. Built world-class remote-first culture.", timeline: JSON.stringify([{date: "2025-01-10", event: "Sourced from HR tech conference"}]) },
    // === CMO / VP Marketing ===
    { name: "Jordan Blake", title: "CMO", company: "NovaBrands Consumer (L Catterton)", location: "Los Angeles, CA", email: "jblake@novabrands.com", phone: "(310) 555-0724", linkedin: "linkedin.com/in/jordanblake-cmo", matchScore: 89, status: "interview", lastContact: "2025-01-15", tags: JSON.stringify(["DTC Marketing", "Brand Strategy", "Growth Marketing", "PE-backed"]), notes: "Grew NovaBrands portfolio from $40M to $180M revenue through digital-first brand strategy.", timeline: JSON.stringify([{date: "2025-01-15", event: "Interview with CEO — strong brand vision"}, {date: "2025-01-10", event: "First call — excellent strategic thinker"}, {date: "2025-01-06", event: "Referral from L Catterton partner"}]) },
    { name: "Aisha Patel", title: "VP Marketing", company: "ScaleUp Fintech", location: "New York, NY", email: "apatel@scaleupft.com", phone: "(212) 555-0419", linkedin: "linkedin.com/in/aishapatel-mktg", matchScore: 85, status: "contacted", lastContact: "2025-01-12", tags: JSON.stringify(["B2B SaaS", "Demand Gen", "Product Marketing", "PLG"]), notes: "Built product-led growth engine that drives 60% of pipeline. HubSpot and Stripe alumni.", timeline: JSON.stringify([{date: "2025-01-12", event: "Email outreach — awaiting response"}, {date: "2025-01-08", event: "Identified via fintech marketing network"}]) },
    { name: "Carlos Mendez", title: "CMO", company: "VitalFit Wellness (TSG Consumer)", location: "Austin, TX", email: "cmendez@vitalfit.com", phone: "(512) 555-0863", linkedin: "linkedin.com/in/carlosmendez-cmo", matchScore: 87, status: "sourced", lastContact: "2025-01-09", tags: JSON.stringify(["Consumer Wellness", "Omnichannel", "Influencer Strategy", "DTC"]), notes: "Led VitalFit rebrand that doubled brand awareness. Deep DTC and retail channel expertise.", timeline: JSON.stringify([{date: "2025-01-09", event: "Added from consumer PE conference connections"}]) },
    // === General Counsel / CLO ===
    { name: "Natalie Chen-Watkins", title: "General Counsel", company: "ShieldTech Compliance (Warburg Pincus)", location: "Washington, DC", email: "ncwatkins@shieldtech.com", phone: "(202) 555-0352", linkedin: "linkedin.com/in/nataliecwatkins-gc", matchScore: 87, status: "screening", lastContact: "2025-01-13", tags: JSON.stringify(["M&A Transactions", "Regulatory Compliance", "IP Portfolio", "PE Transactions"]), notes: "Managed legal for 8 PE acquisitions. Deep regulatory expertise in tech and healthcare.", timeline: JSON.stringify([{date: "2025-01-13", event: "Screening call — impressive M&A depth"}, {date: "2025-01-08", event: "Referred by Warburg legal team"}]) },
    { name: "Thomas Grant", title: "VP Legal & Compliance", company: "Apex Digital Media (Silver Lake)", location: "New York, NY", email: "tgrant@apexdigital.com", phone: "(212) 555-0687", linkedin: "linkedin.com/in/thomasgrant-legal", matchScore: 82, status: "sourced", lastContact: "2025-01-07", tags: JSON.stringify(["Digital Media", "Data Privacy", "IP Licensing", "Corporate Governance"]), notes: "Kirkland & Ellis background. Led GDPR/CCPA compliance buildout across Silver Lake portfolio.", timeline: JSON.stringify([{date: "2025-01-07", event: "Added from legal network sourcing"}]) },
    // === CEO / President ===
    { name: "Katherine Novak", title: "President & COO", company: "Meridian Industries (KKR)", location: "Atlanta, GA", email: "knovak@meridianind.com", phone: "(404) 555-0918", linkedin: "linkedin.com/in/katherinenovak", matchScore: 94, status: "interview", lastContact: "2025-01-15", tags: JSON.stringify(["P&L Ownership", "PE Value Creation", "Board Management", "Scale-up"]), notes: "Grew Meridian from $120M to $450M revenue. KKR wants to promote her but she's exploring external CEO roles.", timeline: JSON.stringify([{date: "2025-01-15", event: "CEO-track interview with PE board"}, {date: "2025-01-10", event: "Strategy presentation — outstanding"}, {date: "2025-01-04", event: "Confidential intro via KKR talent"}]) },
  ];
  for (const c of candidateData) {
    await db.insert(candidates).values(c);
  }

  // Jobs - Multi-function executive searches
  const jobData: InsertJob[] = [
    { title: "Chief Financial Officer", company: "Acme Health Solutions (Thoma Bravo)", location: "Chicago, IL", stage: "interview", candidateCount: 24, daysOpen: 28, feePotential: "$125,000", description: "PE-backed healthcare IT company seeking CFO to lead finance through rapid scaling. $400M revenue, preparing for potential exit in 18-24 months.", requirements: JSON.stringify(["10+ years senior finance leadership", "PE-backed company experience", "Healthcare or SaaS background", "M&A integration experience", "IPO or exit preparation"]) },
    { title: "CFO", company: "Granite Peak Energy (Warburg Pincus)", location: "Dallas, TX", stage: "screening", candidateCount: 15, daysOpen: 21, feePotential: "$150,000", description: "Energy infrastructure company backed by Warburg Pincus. $1.8B in assets, managing complex capital allocation across 40+ facilities.", requirements: JSON.stringify(["Energy/infrastructure background", "Capital project oversight", "PE reporting experience", "Treasury management"]) },
    { title: "VP Finance", company: "Nexus Cloud (Vista Equity)", location: "Austin, TX", stage: "sourcing", candidateCount: 8, daysOpen: 7, feePotential: "$85,000", description: "High-growth B2B SaaS company needs VP Finance to build FP&A function. $120M ARR, growing 40% YoY.", requirements: JSON.stringify(["SaaS metrics expertise", "FP&A team leadership", "Board-level reporting", "Series D+ experience"]) },
    { title: "Chief Technology Officer", company: "BrightPath Health (General Atlantic)", location: "Boston, MA", stage: "interview", candidateCount: 18, daysOpen: 32, feePotential: "$140,000", description: "Healthcare SaaS platform needs CTO to lead AI-driven product roadmap and engineering scaling. $200M ARR.", requirements: JSON.stringify(["AI/ML product leadership", "Healthcare technology experience", "Engineering team of 100+", "Cloud-native architecture", "PE board reporting"]) },
    { title: "VP Engineering", company: "Velocity Commerce (Insight Partners)", location: "San Francisco, CA", stage: "sourcing", candidateCount: 6, daysOpen: 10, feePotential: "$95,000", description: "E-commerce infrastructure platform seeking VP Engineering for platform reliability and scale. 500M+ API calls/day.", requirements: JSON.stringify(["High-scale distributed systems", "E-commerce/payments experience", "Team scaling 50→200", "SRE and platform engineering"]) },
    { title: "Chief Operating Officer", company: "CarePoint Health Network (Bain Capital)", location: "Nashville, TN", stage: "screening", candidateCount: 12, daysOpen: 18, feePotential: "$130,000", description: "Multi-site healthcare services company seeking COO for operational excellence across 60 clinics. PE roll-up strategy.", requirements: JSON.stringify(["Multi-site healthcare operations", "PE roll-up integration", "Process standardization", "EBITDA improvement track record"]) },
    { title: "Chief Human Resources Officer", company: "Pinnacle Consumer Brands (L Catterton)", location: "Los Angeles, CA", stage: "intake", candidateCount: 0, daysOpen: 3, feePotential: "$100,000", description: "PE-backed DTC consumer brand portfolio needs CHRO to build talent function across 4 brands and 800 employees.", requirements: JSON.stringify(["Multi-brand talent strategy", "PE-backed company experience", "Compensation and equity design", "Culture integration post-M&A"]) },
    { title: "Chief Marketing Officer", company: "VitalWell Consumer Health (TSG Consumer)", location: "Austin, TX", stage: "interview", candidateCount: 14, daysOpen: 25, feePotential: "$110,000", description: "Consumer health brand portfolio seeking CMO to drive DTC and retail growth. $300M revenue across 3 brands.", requirements: JSON.stringify(["DTC and retail marketing", "Consumer health/wellness", "Brand portfolio management", "Growth marketing and analytics"]) },
    { title: "General Counsel", company: "CyberVault Security (Thoma Bravo)", location: "Washington, DC", stage: "sourcing", candidateCount: 4, daysOpen: 8, feePotential: "$90,000", description: "Enterprise cybersecurity company needs GC for M&A, government contracts, and regulatory compliance.", requirements: JSON.stringify(["Technology M&A experience", "Government contract law", "Data privacy / cybersecurity regulation", "PE transaction support"]) },
    { title: "Chief Executive Officer", company: "Apex Manufacturing (Carve-out from Honeywell / KKR)", location: "Atlanta, GA", stage: "offer", candidateCount: 22, daysOpen: 55, feePotential: "$200,000", description: "PE carve-out from Fortune 500 seeking CEO to lead standalone company through value creation plan. $600M revenue.", requirements: JSON.stringify(["P&L ownership $500M+", "Carve-out / standalone experience", "Manufacturing/industrial background", "PE board collaboration", "Track record of EBITDA growth"]) },
    { title: "Chief Financial Officer", company: "Heritage Hospitality (Ares Management)", location: "Atlanta, GA", stage: "interview", candidateCount: 20, daysOpen: 35, feePotential: "$120,000", description: "Multi-unit hospitality company with 85 locations. PE-backed franchise model needing CFO for national expansion.", requirements: JSON.stringify(["Multi-unit operations finance", "Franchise model expertise", "EBITDA growth track record", "Real estate finance"]) },
    { title: "VP Operations", company: "MedEquip Logistics (Advent International)", location: "Minneapolis, MN", stage: "intake", candidateCount: 0, daysOpen: 1, feePotential: "$75,000", description: "Medical equipment distribution company seeking VP Ops to optimize nationwide logistics network.", requirements: JSON.stringify(["Supply chain / logistics", "Healthcare distribution", "Warehouse management systems", "Process improvement"]) },
  ];
  for (const j of jobData) {
    await db.insert(jobs).values(j);
  }

  // Opportunities
  const oppData: InsertOpportunity[] = [
    { company: "Blackstone Growth", contactPerson: "Mark Sullivan, Partner", estimatedFee: "$250,000", stage: "negotiation", aiScore: "hot", lastActivity: "2025-01-15", notes: "Multi-search engagement for 3 portfolio companies — CFO, CTO, and COO roles. Final contract review.", winProbability: 85 },
    { company: "Silver Lake Partners", contactPerson: "Diana Wu, Talent Lead", estimatedFee: "$180,000", stage: "proposal", aiScore: "hot", lastActivity: "2025-01-14", notes: "Proposal sent for CTO + VP Engineering dual search. Competing with Russell Reynolds.", winProbability: 65 },
    { company: "Hellman & Friedman", contactPerson: "James Crowley, MD", estimatedFee: "$150,000", stage: "qualified", aiScore: "warm", lastActivity: "2025-01-12", notes: "Initial call went well. Need to schedule deep-dive on their tech & healthcare portfolio.", winProbability: 45 },
    { company: "General Atlantic", contactPerson: "Priya Sharma, VP", estimatedFee: "$200,000", stage: "lead", aiScore: "warm", lastActivity: "2025-01-10", notes: "Met at ACG conference. Interested in our cross-functional executive search specialty.", winProbability: 25 },
    { company: "Advent International", contactPerson: "Robert Chen, Partner", estimatedFee: "$135,000", stage: "won", aiScore: "hot", lastActivity: "2025-01-15", notes: "Signed! COO search for CarePoint Health Network. Kick-off next week.", winProbability: 100 },
    { company: "Bain Capital", contactPerson: "Lisa Park, Talent", estimatedFee: "$175,000", stage: "proposal", aiScore: "warm", lastActivity: "2025-01-13", notes: "Following up on CHRO search for consumer portfolio company.", winProbability: 50 },
    { company: "TPG Capital", contactPerson: "Michael Reeves, MD", estimatedFee: "$160,000", stage: "lead", aiScore: "cold", lastActivity: "2025-01-05", notes: "Cold outreach. No response yet to second follow-up.", winProbability: 10 },
    { company: "Warburg Pincus", contactPerson: "Stephanie Adams, VP", estimatedFee: "$150,000", stage: "won", aiScore: "hot", lastActivity: "2025-01-08", notes: "Granite Peak CFO search in progress. Strong relationship — discussing CTO search next.", winProbability: 100 },
    { company: "Vista Equity Partners", contactPerson: "Carlos Mendez, Partner", estimatedFee: "$85,000", stage: "negotiation", aiScore: "hot", lastActivity: "2025-01-14", notes: "Nexus Cloud VP Finance — terms being finalized. Discussing VP Eng search next.", winProbability: 80 },
    { company: "KKR", contactPerson: "Emma Williams, Talent", estimatedFee: "$310,000", stage: "qualified", aiScore: "warm", lastActivity: "2025-01-11", notes: "CEO search for Apex Manufacturing carve-out plus CFO for EdTech platform. Building relationship.", winProbability: 40 },
  ];
  for (const o of oppData) {
    await db.insert(opportunities).values(o);
  }

  // Campaigns
  const campaignData: InsertCampaign[] = [
    { name: "C-Suite Healthcare & Tech Outreach Q1", channel: "email", status: "active", sentCount: 245, openRate: 68.5, replyRate: 22.3, steps: JSON.stringify([{day: 1, type: "Email", subject: "Executive opportunity in PE-backed healthcare/tech", sent: 245, opened: 168, replied: 55, bounced: 5}, {day: 3, type: "LinkedIn", subject: "Connection request + note", sent: 220, opened: 0, replied: 44, bounced: 0}, {day: 5, type: "Email", subject: "Follow-up with role details", sent: 175, opened: 124, replied: 28, bounced: 2}, {day: 7, type: "Phone", subject: "Direct call", sent: 72, opened: 0, replied: 35, bounced: 0}]) },
    { name: "Executive SaaS Pipeline", channel: "linkedin", status: "active", sentCount: 134, openRate: 72.1, replyRate: 18.7, steps: JSON.stringify([{day: 1, type: "LinkedIn", subject: "InMail — CTO/VP Eng/VP Finance roles", sent: 134, opened: 0, replied: 25, bounced: 0}, {day: 4, type: "Email", subject: "Detailed role overview", sent: 108, opened: 82, replied: 18, bounced: 3}, {day: 7, type: "Email", subject: "Company culture piece", sent: 88, opened: 61, replied: 12, bounced: 0}]) },
    { name: "PE Partner BD Outreach", channel: "email", status: "active", sentCount: 312, openRate: 45.2, replyRate: 8.6, steps: JSON.stringify([{day: 1, type: "Email", subject: "Intro — The Hiring Advisors", sent: 312, opened: 141, replied: 27, bounced: 6}, {day: 5, type: "Email", subject: "Case study: Recent C-suite placements", sent: 260, opened: 115, replied: 18, bounced: 3}, {day: 10, type: "LinkedIn", subject: "Connect + engage", sent: 225, opened: 0, replied: 13, bounced: 0}, {day: 15, type: "Email", subject: "Final touch — market insights", sent: 195, opened: 81, replied: 10, bounced: 1}]) },
    { name: "Passive Executive Nurture", channel: "email", status: "paused", sentCount: 420, openRate: 52.8, replyRate: 12.4, steps: JSON.stringify([{day: 1, type: "Email", subject: "Executive compensation market report", sent: 420, opened: 222, replied: 52, bounced: 10}, {day: 14, type: "Email", subject: "Industry trends newsletter", sent: 375, opened: 190, replied: 34, bounced: 4}, {day: 30, type: "Email", subject: "Exclusive role preview", sent: 340, opened: 174, replied: 29, bounced: 3}]) },
    { name: "Executive Referral Campaign", channel: "phone", status: "completed", sentCount: 95, openRate: 0, replyRate: 34.3, steps: JSON.stringify([{day: 1, type: "Phone", subject: "Warm call — referral request", sent: 95, opened: 0, replied: 33, bounced: 0}, {day: 3, type: "Email", subject: "Follow-up with referral form", sent: 72, opened: 53, replied: 25, bounced: 1}, {day: 7, type: "Phone", subject: "Thank you + additional asks", sent: 42, opened: 0, replied: 19, bounced: 0}]) },
    { name: "Placed Executive Alumni Network", channel: "email", status: "active", sentCount: 68, openRate: 81.0, replyRate: 45.2, steps: JSON.stringify([{day: 1, type: "Email", subject: "Check-in from Andrew", sent: 68, opened: 55, replied: 31, bounced: 0}, {day: 30, type: "Email", subject: "Quarterly market update", sent: 62, opened: 50, replied: 24, bounced: 0}]) },
  ];
  for (const c of campaignData) {
    await db.insert(campaigns).values(c);
  }

  // Activities
  const activityData: InsertActivity[] = [
    { type: "interview", description: "Second interview scheduled with Sarah Chen for Acme Health CFO role", timestamp: "2025-01-15T14:30:00", relatedName: "Sarah Chen" },
    { type: "interview", description: "Technical deep-dive with Alex Rivera for BrightPath Health CTO position", timestamp: "2025-01-15T13:00:00", relatedName: "Alex Rivera" },
    { type: "interview", description: "Jordan Blake CMO interview with VitalWell CEO — strong brand vision alignment", timestamp: "2025-01-15T11:30:00", relatedName: "Jordan Blake" },
    { type: "placement", description: "Jennifer Park — offer extended for Summit Capital CFO ($425K + equity)", timestamp: "2025-01-15T09:15:00", relatedName: "Jennifer Park" },
    { type: "call", description: "BD call with Blackstone Growth — discussing multi-function search engagement", timestamp: "2025-01-14T16:00:00", relatedName: "Blackstone Growth" },
    { type: "note", description: "Completed screening notes for Diana Foster — exceptional CHRO candidate for TalentForge", timestamp: "2025-01-14T14:00:00", relatedName: "Diana Foster" },
    { type: "interview", description: "Marcus Williams COO interview with Bain Capital operating partner — impressive ops background", timestamp: "2025-01-14T10:00:00", relatedName: "Marcus Williams" },
    { type: "email", description: "Proposal sent to Silver Lake Partners for CTO + VP Engineering dual search", timestamp: "2025-01-13T15:30:00", relatedName: "Silver Lake Partners" },
    { type: "note", description: "Katherine Novak CEO-track strategy presentation — outstanding PE value creation narrative", timestamp: "2025-01-13T11:00:00", relatedName: "Katherine Novak" },
    { type: "email", description: "Outreach to Natalie Chen-Watkins for General Counsel search — Warburg referral", timestamp: "2025-01-12T09:00:00", relatedName: "Natalie Chen-Watkins" },
  ];
  for (const a of activityData) {
    await db.insert(activities).values(a);
  }

  // Interviews
  const interviewData: InsertInterview[] = [
    { candidateId: 1, candidateName: "Sarah Chen", candidateTitle: "CFO", jobTitle: "Chief Financial Officer", jobCompany: "Acme Health Solutions", interviewType: "final", interviewDate: "2025-01-14", interviewer: "David Kim, CEO", duration: 75, overallRating: 5, notes: "Exceptional interview. Sarah demonstrated deep understanding of PE-backed healthcare finance. Presented a 90-day plan that impressed the board. Strong chemistry with CEO.", strengths: JSON.stringify(["PE reporting and board management", "Healthcare industry expertise", "Strategic financial planning", "Clear communicator — articulate and concise"]), concerns: JSON.stringify(["Currently in a larger organization — may need to adjust to leaner team"]), salaryDiscussed: "$400K-$450K base + equity participation. Current comp at $380K.", nextSteps: "Prepare offer letter. Target $425K base + 1% equity.", recommendation: "advance" },
    { candidateId: 5, candidateName: "Alex Rivera", candidateTitle: "CTO", jobTitle: "Chief Technology Officer", jobCompany: "BrightPath Health", interviewType: "technical", interviewDate: "2025-01-15", interviewer: "Engineering Committee (3 panelists)", duration: 120, overallRating: 4, notes: "Technical deep-dive went very well. Alex whiteboarded a migration architecture from monolith to microservices that was well-received. Strong AI/ML knowledge.", strengths: JSON.stringify(["Cloud architecture — deep AWS and GCP experience", "AI/ML product integration — built 3 ML products", "Team scaling — grew eng from 12 to 85", "Pragmatic approach to technical debt"]), concerns: JSON.stringify(["Has not worked in healthcare-regulated environment before", "Compensation expectations may be high given SF market"]), salaryDiscussed: "Expecting $350K-$400K total. Current total comp ~$380K (base + RSUs at DataPulse).", nextSteps: "Schedule final interview with PE operating partner. Prepare healthcare compliance briefing.", recommendation: "advance" },
    { candidateId: 8, candidateName: "Marcus Williams", candidateTitle: "COO", jobTitle: "Chief Operating Officer", jobCompany: "CarePoint Health Network", interviewType: "pe_partner", interviewDate: "2025-01-14", interviewer: "James Reed, Bain Capital Operating Partner", duration: 60, overallRating: 5, notes: "Outstanding session. Marcus presented his EBITDA improvement playbook from HealthBridge — 35% margin improvement across 40 locations. Bain partner was highly impressed.", strengths: JSON.stringify(["Proven PE value creation — 35% EBITDA improvement", "Multi-site healthcare operations expert", "McKinsey framework plus hands-on execution", "Strong relationship builder with clinical teams"]), concerns: JSON.stringify([]), salaryDiscussed: "$325K-$375K range discussed. Open to performance-based equity upside.", nextSteps: "Bain partner wants to move to offer. Discuss comp package and start date.", recommendation: "advance" },
    { candidateId: 13, candidateName: "Jordan Blake", candidateTitle: "CMO", jobTitle: "Chief Marketing Officer", jobCompany: "VitalWell Consumer Health", interviewType: "first_round", interviewDate: "2025-01-15", interviewer: "Amanda Torres, CEO", duration: 60, overallRating: 4, notes: "Strong first impression. Jordan's DTC brand portfolio at NovaBrands is directly relevant. Presented a case study of growing a wellness brand from $8M to $45M in 2 years.", strengths: JSON.stringify(["DTC growth marketing — proven at scale", "Consumer health/wellness domain expertise", "Data-driven decision making", "Strong team leadership — built 25-person marketing team"]), concerns: JSON.stringify(["Retail/wholesale channel experience is thinner", "May need to adjust to PE reporting cadence"]), salaryDiscussed: "Looking for $280K-$320K base. Current at $275K + bonus.", nextSteps: "Schedule second round with PE partner and VP Sales.", recommendation: "advance" },
    { candidateId: 11, candidateName: "Diana Foster", candidateTitle: "CHRO", jobTitle: "Chief Human Resources Officer", jobCompany: "Pinnacle Consumer Brands", interviewType: "phone_screen", interviewDate: "2025-01-14", interviewer: "Andrew (The Hiring Advisors)", duration: 45, overallRating: 5, notes: "Phenomenal candidate. Diana redesigned Vista Equity's entire portfolio comp structure. She understands PE talent strategy at a deep level. SHRM board member.", strengths: JSON.stringify(["PE portfolio-wide talent strategy", "Comp and equity design expertise", "Culture transformation through M&A", "Strong executive presence and credibility"]), concerns: JSON.stringify(["Consumer brands is a new vertical for her — has been in tech/SaaS"]), salaryDiscussed: "Targeting $300K+ base. Currently at $310K at TalentForge.", nextSteps: "Present to Pinnacle CEO. Prepare industry transition narrative.", recommendation: "advance" },
    { candidateId: 7, candidateName: "James Liu", candidateTitle: "CTO", jobTitle: "VP Engineering", jobCompany: "Velocity Commerce", interviewType: "phone_screen", interviewDate: "2025-01-12", interviewer: "Andrew (The Hiring Advisors)", duration: 30, overallRating: 3, notes: "Good technical background but may be overqualified for VP Eng role — he's a current CTO. Seemed more interested in CTO positions.", strengths: JSON.stringify(["Strong fintech infrastructure experience", "SOC2/PCI compliance expertise", "Microservices architecture"]), concerns: JSON.stringify(["Overqualified for VP Eng — looking for CTO title", "May not stay long in a step-down role"]), salaryDiscussed: "Not discussed in detail — wants to understand role level first.", nextSteps: "Redirect to BrightPath Health CTO opportunity. Follow up next week.", recommendation: "hold" },
  ];
  for (const iv of interviewData) {
    await db.insert(interviews).values(iv);
  }
}

// Bootstrap admin user — runs in ALL environments on every startup.
// Creates the initial admin account when no users exist yet (fresh DB).
// Uses ADMIN_EMAIL / ADMIN_PASSWORD env vars; falls back to safe defaults that
// are printed to the server console so the operator can log in on first boot.
async function bootstrapAdmin() {
  if (!process.env.DATABASE_URL) return;
  try {
    const existing = await db.select().from(users);
    if (existing.length > 0) return;

    const email    = process.env.ADMIN_EMAIL    || "admin@hirecommand.com";
    const password = process.env.ADMIN_PASSWORD || "ChangeMe123!";

    const bcrypt = await import("bcrypt");
    const hashed = await bcrypt.hash(password, 10);
    await db.insert(users).values({
      email,
      username: email,
      password: hashed,
      role: "admin",
      recruiterName: "Admin",
    });

    console.log(`[bootstrap] ✅ Admin user created`);
    console.log(`[bootstrap]    Email:    ${email}`);
    if (!process.env.ADMIN_PASSWORD) {
      console.log(`[bootstrap]    Password: ${password}  ← SET ADMIN_PASSWORD env var and log in to change this`);
    }
  } catch (err: any) {
    console.error("[bootstrap] Failed to create admin user:", err.message);
  }
}

if (process.env.DATABASE_URL) {
  bootstrapAdmin().catch(err => console.error("[bootstrap] Error:", err.message));
}

// Only seed demo data in development — never flood the production DB with fake data
if (process.env.DATABASE_URL && process.env.NODE_ENV !== "production") {
  seed().catch(err => console.error("[seed] Failed:", err.message));
}
