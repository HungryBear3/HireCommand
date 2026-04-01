import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const candidates = sqliteTable("candidates", {
  id: integer("id").primaryKey({ autoIncrement: true }),
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
});

export const jobs = sqliteTable("jobs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  company: text("company").notNull(),
  location: text("location").notNull(),
  stage: text("stage").notNull(), // intake, sourcing, screening, interview, offer, placed
  candidateCount: integer("candidate_count").notNull(),
  daysOpen: integer("days_open").notNull(),
  feePotential: text("fee_potential").notNull(),
  description: text("description").notNull(),
  requirements: text("requirements").notNull(), // JSON array
});

export const opportunities = sqliteTable("opportunities", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  company: text("company").notNull(),
  contactPerson: text("contact_person").notNull(),
  estimatedFee: text("estimated_fee").notNull(),
  stage: text("stage").notNull(), // lead, qualified, proposal, negotiation, won, lost
  aiScore: text("ai_score").notNull(), // hot, warm, cold
  lastActivity: text("last_activity").notNull(),
  notes: text("notes").notNull(),
  winProbability: integer("win_probability").notNull(),
});

export const campaigns = sqliteTable("campaigns", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  channel: text("channel").notNull(), // email, sms, linkedin, phone
  status: text("status").notNull(), // active, paused, completed
  sentCount: integer("sent_count").notNull(),
  openRate: real("open_rate").notNull(),
  replyRate: real("reply_rate").notNull(),
  steps: text("steps").notNull(), // JSON array of sequence steps
});

export const activities = sqliteTable("activities", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  type: text("type").notNull(), // email, call, interview, note, placement
  description: text("description").notNull(),
  timestamp: text("timestamp").notNull(),
  relatedName: text("related_name").notNull(),
});

// New: Interview Intelligence table
export const interviews = sqliteTable("interviews", {
  id: integer("id").primaryKey({ autoIncrement: true }),
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

// Insert schemas
export const insertUserSchema = createInsertSchema(users).pick({ username: true, password: true });
export const insertCandidateSchema = createInsertSchema(candidates).omit({ id: true });
export const insertJobSchema = createInsertSchema(jobs).omit({ id: true });
export const insertOpportunitySchema = createInsertSchema(opportunities).omit({ id: true });
export const insertCampaignSchema = createInsertSchema(campaigns).omit({ id: true });
export const insertActivitySchema = createInsertSchema(activities).omit({ id: true });
export const insertInterviewSchema = createInsertSchema(interviews).omit({ id: true });

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type Candidate = typeof candidates.$inferSelect;
export type InsertCandidate = z.infer<typeof insertCandidateSchema>;
export type Job = typeof jobs.$inferSelect;
export type InsertJob = z.infer<typeof insertJobSchema>;
export type Opportunity = typeof opportunities.$inferSelect;
export type InsertOpportunity = z.infer<typeof insertOpportunitySchema>;
export type Campaign = typeof campaigns.$inferSelect;
export type InsertCampaign = z.infer<typeof insertCampaignSchema>;
export type Activity = typeof activities.$inferSelect;
export type InsertActivity = z.infer<typeof insertActivitySchema>;
export type Interview = typeof interviews.$inferSelect;
export type InsertInterview = z.infer<typeof insertInterviewSchema>;
