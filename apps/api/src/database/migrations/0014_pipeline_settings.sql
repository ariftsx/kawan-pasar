ALTER TYPE "public"."audit_action" ADD VALUE 'pipeline_trigger';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'pipeline_pause';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'pipeline_resume';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'pipeline_schedule';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'model_approve';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'model_reject';--> statement-breakpoint
CREATE TABLE "pipeline_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pipeline_settings" ADD CONSTRAINT "pipeline_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- Admin settings of the pipeline (Fase 4C): read by the DAGs through the internal API.
GRANT SELECT, INSERT, UPDATE ON pipeline_settings TO app_rw;
