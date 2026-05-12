import { pgTable, text, integer, real, serial, doublePrecision } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").unique(),            // login identifier
  role: text("role").notNull().default("user"), // 'admin' | 'user'
  recruiterName: text("recruiter_name"),    // 'Andrew' | 'Ryan' | 'Aileen' — links user to commission data
});

export const candidates = pgTable("candidates", {
  id: serial("id").primaryKey(),
  loxoId: integer("loxo_id").unique(), // Loxo person ID for sync dedup
  name: text("name").notNull(),
  title: text("title").notNull(),
  company: text("company").notNull(),
  location: text("location").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  linkedin: text("linkedin").notNull(),
  matchScore: integer("match_score").notNull(),
  status: text("status").notNull(), // sourced, contacted, screening, interview, offer, placed
  lastContact: text("last_contact").notNull(),
  tags: text("tags").notNull(), // JSON array
  notes: text("notes").notNull(),
  timeline: text("timeline").notNull(), // JSON array of events
  // LinkedIn profile sync
  linkedinSyncedAt: text("linkedin_synced_at"),    // ISO timestamp of last successful sync
  linkedinSnapshot: text("linkedin_snapshot"),     // JSON: last known profile data for diff
  linkedinChanges: text("linkedin_changes"),       // JSON array of detected change objects
  linkedinSyncError: text("linkedin_sync_error"),  // last error message if sync failed
});

export const jobs = pgTable("jobs", {
  id: serial("id").primaryKey(),
  loxoId: integer("loxo_id").unique(), // Loxo job ID for sync dedup
  title: text("title").notNull(),
  company: text("company").notNull(),
  location: text("location").notNull(),
  stage: text("stage").notNull(), // intake, sourcing, screening, interview, offer, placed, closed
  candidateCount: integer("candidate_count").notNull(),
  daysOpen: integer("days_open").notNull(),
  feePotential: text("fee_potential").notNull(),
  description: text("description").notNull(),
  requirements: text("requirements").notNull(), // JSON array
});

export const loxoCompanies = pgTable("loxo_companies", {
  id: serial("id").primaryKey(),
  loxoId: integer("loxo_id").unique(),
  name: text("name").notNull(),
  website: text("website").notNull().default(""),
  location: text("location").notNull().default(""),
  industry: text("industry").notNull().default(""),
  ownerName: text("owner_name").notNull().default(""),
  rawJson: text("raw_json").notNull().default("{}"),
  syncedAt: text("synced_at").notNull(),
});

export const loxoClients = pgTable("loxo_clients", {
  id: serial("id").primaryKey(),
  loxoId: integer("loxo_id").unique(),
  name: text("name").notNull(),
  company: text("company").notNull().default(""),
  title: text("title").notNull().default(""),
  email: text("email").notNull().default(""),
  phone: text("phone").notNull().default(""),
  location: text("location").notNull().default(""),
  rawJson: text("raw_json").notNull().default("{}"),
  syncedAt: text("synced_at").notNull(),
});

export const candidateJobAssignments = pgTable("candidate_job_assignments", {
  id: serial("id").primaryKey(),
  candidateId: integer("candidate_id").notNull(),
  jobId: integer("job_id").notNull(),
  status: text("status").notNull().default("submitted"),
  notes: text("notes").notNull().default(""),
  evaluationScore: integer("evaluation_score"),
  evaluationVerdict: text("evaluation_verdict"),
  evaluationSummary: text("evaluation_summary"),
  evaluationJson: text("evaluation_json"),
  evaluatedAt: text("evaluated_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const opportunities = pgTable("opportunities", {
  id: serial("id").primaryKey(),
  company: text("company").notNull(),
  contactPerson: text("contact_person").notNull(),
  estimatedFee: text("estimated_fee").notNull(),
  stage: text("stage").notNull(), // lead, qualified, proposal, negotiation, won, lost
  aiScore: text("ai_score").notNull(), // hot, warm, cold
  lastActivity: text("last_activity").notNull(),
  notes: text("notes").notNull(),
  winProbability: integer("win_probability").notNull(),
});

export const campaigns = pgTable("campaigns", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  channel: text("channel").notNull(), // email, sms, linkedin, phone
  status: text("status").notNull(), // active, paused, completed
  sentCount: integer("sent_count").notNull(),
  openRate: doublePrecision("open_rate").notNull(),
  replyRate: doublePrecision("reply_rate").notNull(),
  steps: text("steps").notNull(), // JSON array of sequence steps
});

export const activities = pgTable("activities", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(), // email, call, interview, note, placement
  description: text("description").notNull(),
  timestamp: text("timestamp").notNull(),
  relatedName: text("related_name").notNull(),
});

// Interview Intelligence table
export const interviews = pgTable("interviews", {
  id: serial("id").primaryKey(),
  candidateId: integer("candidate_id").notNull(),
  candidateName: text("candidate_name").notNull(),
  candidateTitle: text("candidate_title").notNull(),
  jobTitle: text("job_title").notNull(),
  jobCompany: text("job_company").notNull(),
  interviewType: text("interview_type").notNull(), // phone_screen, first_round, technical, final, pe_partner
  interviewDate: text("interview_date").notNull(),
  interviewer: text("interviewer").notNull(),
  duration: integer("duration").notNull(), // minutes
  overallRating: integer("overall_rating").notNull(), // 1-5
  notes: text("notes").notNull(),
  strengths: text("strengths").notNull(), // JSON array
  concerns: text("concerns").notNull(), // JSON array
  salaryDiscussed: text("salary_discussed"), // nullable — captured salary mention
  nextSteps: text("next_steps").notNull(),
  recommendation: text("recommendation").notNull(), // advance, hold, pass
});

// Placements — source of truth for completed deals and revenue
export const placements = pgTable("placements", {
  id: serial("id").primaryKey(),
  // Search / job info
  jobTitle: text("job_title").notNull(),
  company: text("company").notNull(),
  clientName: text("client_name").notNull(), // PE firm or direct client
  // Candidate info
  candidateName: text("candidate_name").notNull(),
  candidateId: integer("candidate_id"), // optional FK to candidates table
  // Financial
  salary: doublePrecision("salary").notNull(),          // annual base salary placed at
  feePercent: doublePrecision("fee_percent").notNull(), // e.g. 25.0 = 25%
  feeAmount: doublePrecision("fee_amount").notNull(),   // computed: salary * feePercent / 100
  invoiceStatus: text("invoice_status").notNull().default("pending"), // pending, invoiced, partial, paid
  invoiceDate: text("invoice_date"),         // when invoice was sent
  paidDate: text("paid_date"),               // when cash received
  paidAmount: doublePrecision("paid_amount").default(0), // actual cash received
  // Placement details
  placedDate: text("placed_date").notNull(), // offer accepted date
  startDate: text("start_date"),             // candidate start date
  guaranteeDays: integer("guarantee_days").default(90), // replacement guarantee period
  notes: text("notes").default(""),
  // Ownership
  leadRecruiter: text("lead_recruiter").notNull(), // Andrew | Ryan | Aileen
});

// Commission splits — one or more rows per placement
export const commissionSplits = pgTable("commission_splits", {
  id: serial("id").primaryKey(),
  placementId: integer("placement_id").notNull(), // FK → placements.id
  employee: text("employee").notNull(),           // Andrew | Ryan | Aileen
  splitPercent: doublePrecision("split_percent").notNull(),  // % of total fee this person gets
  commissionRate: doublePrecision("commission_rate").notNull(), // their personal comm rate
  commissionAmount: doublePrecision("commission_amount").notNull(), // computed amount
});

// Invoices — standalone billing records (may link to a placement)
export const invoices = pgTable("invoices", {
  id: serial("id").primaryKey(),
  // Invoice identity
  invoiceNumber: text("invoice_number").notNull(),
  status: text("status").notNull().default("draft"), // draft | sent | viewed | partial | paid | void
  // Client / candidate
  clientName: text("client_name").notNull(),
  clientEmail: text("client_email").default(""),
  clientAddress: text("client_address").default(""),
  candidateName: text("candidate_name").default(""),
  jobTitle: text("job_title").default(""),
  // Financial
  salary: doublePrecision("salary").default(0),
  feePercent: doublePrecision("fee_percent").default(0),
  subtotal: doublePrecision("subtotal").notNull(),
  taxPercent: doublePrecision("tax_percent").default(0),
  taxAmount: doublePrecision("tax_amount").default(0),
  total: doublePrecision("total").notNull(),
  amountPaid: doublePrecision("amount_paid").default(0),
  amountDue: doublePrecision("amount_due").notNull(),
  // Line items stored as JSON array
  lineItems: text("line_items").notNull().default("[]"),
  // Dates
  issueDate: text("issue_date").notNull(),
  dueDate: text("due_date").notNull(),
  paidDate: text("paid_date"),
  // Notes
  notes: text("notes").default(""),
  terms: text("terms").default("Net 30"),
  // QuickBooks sync
  qbInvoiceId: text("qb_invoice_id"),
  qbCustomerId: text("qb_customer_id"),
  qbSyncToken: text("qb_sync_token"),
  qbSyncedAt: text("qb_synced_at"),
  qbPaymentId: text("qb_payment_id"),
  // Link to placement (optional)
  placementId: integer("placement_id"),
  // Meta
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// Settings (key-value store for integration credentials & sync state)
export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).pick({ username: true, password: true });
export const insertCandidateSchema = createInsertSchema(candidates).omit({ id: true });
export const schedulingSessions = pgTable("scheduling_sessions", {
  id: serial("id").primaryKey(),
  candidateId: integer("candidate_id").notNull(),
  candidateName: text("candidate_name").notNull(),
  candidateEmail: text("candidate_email").notNull().default(""),
  jobId: integer("job_id"),
  jobTitle: text("job_title").notNull(),
  company: text("company").notNull(),
  contactName: text("contact_name").notNull(),
  contactEmail: text("contact_email").notNull().default(""),
  interviewType: text("interview_type").notNull().default("first_round"),
  proposedTimes: text("proposed_times").notNull().default("[]"),
  candidateDraft: text("candidate_draft").notNull().default(""),
  contactDraft: text("contact_draft").notNull().default(""),
  status: text("status").notNull().default("drafting"),
  confirmedTime: text("confirmed_time"),
  notes: text("notes").notNull().default(""),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const insertJobSchema = createInsertSchema(jobs).omit({ id: true });
export const insertLoxoCompanySchema = createInsertSchema(loxoCompanies).omit({ id: true });
export const insertLoxoClientSchema = createInsertSchema(loxoClients).omit({ id: true });
export const insertCandidateJobAssignmentSchema = createInsertSchema(candidateJobAssignments).omit({ id: true });
export const insertOpportunitySchema = createInsertSchema(opportunities).omit({ id: true });
export const insertCampaignSchema = createInsertSchema(campaigns).omit({ id: true });
export const insertActivitySchema = createInsertSchema(activities).omit({ id: true });
export const insertInterviewSchema = createInsertSchema(interviews).omit({ id: true });
export const insertPlacementSchema = createInsertSchema(placements).omit({ id: true });
export const insertCommissionSplitSchema = createInsertSchema(commissionSplits).omit({ id: true });
export const insertInvoiceSchema = createInsertSchema(invoices).omit({ id: true });
export const insertSchedulingSessionSchema = createInsertSchema(schedulingSessions).omit({ id: true });

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type Candidate = typeof candidates.$inferSelect;
export type InsertCandidate = z.infer<typeof insertCandidateSchema>;
export type Job = typeof jobs.$inferSelect;
export type InsertJob = z.infer<typeof insertJobSchema>;
export type LoxoCompany = typeof loxoCompanies.$inferSelect;
export type InsertLoxoCompany = z.infer<typeof insertLoxoCompanySchema>;
export type LoxoClient = typeof loxoClients.$inferSelect;
export type InsertLoxoClient = z.infer<typeof insertLoxoClientSchema>;
export type CandidateJobAssignment = typeof candidateJobAssignments.$inferSelect;
export type InsertCandidateJobAssignment = z.infer<typeof insertCandidateJobAssignmentSchema>;
export type Opportunity = typeof opportunities.$inferSelect;
export type InsertOpportunity = z.infer<typeof insertOpportunitySchema>;
export type Campaign = typeof campaigns.$inferSelect;
export type InsertCampaign = z.infer<typeof insertCampaignSchema>;
export type Activity = typeof activities.$inferSelect;
export type InsertActivity = z.infer<typeof insertActivitySchema>;
export type Interview = typeof interviews.$inferSelect;
export type InsertInterview = z.infer<typeof insertInterviewSchema>;
export type Placement = typeof placements.$inferSelect;
export type InsertPlacement = z.infer<typeof insertPlacementSchema>;
export type CommissionSplit = typeof commissionSplits.$inferSelect;
export type InsertCommissionSplit = z.infer<typeof insertCommissionSplitSchema>;
export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type SchedulingSession = typeof schedulingSessions.$inferSelect;
export type InsertSchedulingSession = z.infer<typeof insertSchedulingSessionSchema>;
