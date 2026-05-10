CREATE TABLE IF NOT EXISTS "loxo_companies" (
	"id" serial PRIMARY KEY NOT NULL,
	"loxo_id" integer,
	"name" text NOT NULL,
	"website" text DEFAULT '' NOT NULL,
	"location" text DEFAULT '' NOT NULL,
	"industry" text DEFAULT '' NOT NULL,
	"owner_name" text DEFAULT '' NOT NULL,
	"raw_json" text DEFAULT '{}' NOT NULL,
	"synced_at" text NOT NULL,
	CONSTRAINT "loxo_companies_loxo_id_unique" UNIQUE("loxo_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "loxo_clients" (
	"id" serial PRIMARY KEY NOT NULL,
	"loxo_id" integer,
	"name" text NOT NULL,
	"company" text DEFAULT '' NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"location" text DEFAULT '' NOT NULL,
	"raw_json" text DEFAULT '{}' NOT NULL,
	"synced_at" text NOT NULL,
	CONSTRAINT "loxo_clients_loxo_id_unique" UNIQUE("loxo_id")
);
