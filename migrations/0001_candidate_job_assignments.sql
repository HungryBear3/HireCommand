CREATE TABLE IF NOT EXISTS "candidate_job_assignments" (
  "id" serial PRIMARY KEY,
  "candidate_id" integer NOT NULL,
  "job_id" integer NOT NULL,
  "status" text NOT NULL DEFAULT 'submitted',
  "notes" text NOT NULL DEFAULT '',
  "created_at" text NOT NULL,
  "updated_at" text NOT NULL,
  UNIQUE ("candidate_id", "job_id")
);
