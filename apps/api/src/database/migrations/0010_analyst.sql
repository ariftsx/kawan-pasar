CREATE TYPE "public"."analyst_request_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."audit_action" AS ENUM('role_request', 'role_grant', 'role_revoke', 'role_reject', 'export_prices', 'export_forecasts');--> statement-breakpoint
ALTER TYPE "public"."user_role" ADD VALUE 'analyst';--> statement-breakpoint
ALTER TYPE "public"."user_role" ADD VALUE 'admin';--> statement-breakpoint
CREATE TABLE "analyst_requests" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "analyst_requests_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"user_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"organization" text,
	"status" "analyst_request_status" DEFAULT 'pending' NOT NULL,
	"decided_by" uuid,
	"decided_at" timestamp with time zone,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "analyst_requests_reason_length" CHECK (length("analyst_requests"."reason") BETWEEN 10 AND 500),
	CONSTRAINT "analyst_requests_org_length" CHECK ("analyst_requests"."organization" IS NULL OR length("analyst_requests"."organization") <= 120),
	CONSTRAINT "analyst_requests_note_length" CHECK ("analyst_requests"."note" IS NULL OR length("analyst_requests"."note") <= 500)
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "audit_log_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"actor_id" uuid,
	"action" "audit_action" NOT NULL,
	"target" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "audit_log_target_length" CHECK ("audit_log"."target" IS NULL OR length("audit_log"."target") <= 200)
);
--> statement-breakpoint
ALTER TABLE "analyst_requests" ADD CONSTRAINT "analyst_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analyst_requests" ADD CONSTRAINT "analyst_requests_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "analyst_requests_one_pending" ON "analyst_requests" USING btree ("user_id") WHERE "analyst_requests"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "analyst_requests_status_idx" ON "analyst_requests" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "audit_log_created_idx" ON "audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audit_log_actor_idx" ON "audit_log" USING btree ("actor_id");--> statement-breakpoint
-- Mode Analis (Fase 3A): the API and worker only (app_rw). audit_log is append-only for the app.
GRANT SELECT, INSERT, UPDATE ON analyst_requests TO app_rw;--> statement-breakpoint
GRANT SELECT, INSERT ON audit_log TO app_rw;
--> statement-breakpoint
-- The app may not delete audit entries; only this function removes those older than a year
-- (retention, worker). A compromised app therefore cannot erase recent traces.
CREATE FUNCTION prune_audit_log() RETURNS integer
  LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, public
  AS $$ WITH gone AS (DELETE FROM public.audit_log WHERE created_at < now() - interval '365 days' RETURNING 1)
        SELECT count(*)::int FROM gone $$;--> statement-breakpoint
REVOKE ALL ON FUNCTION prune_audit_log() FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION prune_audit_log() TO app_rw;
