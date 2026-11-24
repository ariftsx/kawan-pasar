CREATE TYPE "public"."model_candidate_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TABLE "model_candidates" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "model_candidates_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"run_id" text NOT NULL,
	"bundle_id" text NOT NULL,
	"bundle_sha256" text NOT NULL,
	"model_version" text NOT NULL,
	"data_end" date NOT NULL,
	"lock_open" boolean NOT NULL,
	"commodities" text[] NOT NULL,
	"overall_relmae" numeric(8, 4) NOT NULL,
	"scores" jsonb NOT NULL,
	"window_start" date NOT NULL,
	"window_end" date NOT NULL,
	"status" "model_candidate_status" DEFAULT 'pending' NOT NULL,
	"decided_by" uuid,
	"decided_at" timestamp with time zone,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "model_candidates_runId_unique" UNIQUE("run_id"),
	CONSTRAINT "model_candidates_bundleId_unique" UNIQUE("bundle_id"),
	CONSTRAINT "model_candidates_run_id_format" CHECK ("model_candidates"."run_id" ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$'),
	CONSTRAINT "model_candidates_bundle_sha_hex" CHECK ("model_candidates"."bundle_sha256" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "model_candidates_note_length" CHECK ("model_candidates"."note" IS NULL OR length("model_candidates"."note") <= 500)
);
--> statement-breakpoint
ALTER TABLE "model_candidates" ADD CONSTRAINT "model_candidates_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "model_candidates_status_idx" ON "model_candidates" USING btree ("status","created_at");--> statement-breakpoint
-- Registered by the pipeline (service token) and decided by an admin: never deleted by the app.
GRANT SELECT, INSERT, UPDATE ON model_candidates TO app_rw;
