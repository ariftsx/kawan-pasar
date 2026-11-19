CREATE TYPE "public"."whatsapp_message_kind" AS ENUM('code', 'alerts', 'weekly', 'reply');--> statement-breakpoint
CREATE TYPE "public"."whatsapp_status" AS ENUM('pending', 'verified', 'stopped');--> statement-breakpoint
ALTER TYPE "public"."auth_event_type" ADD VALUE 'wa_verify';--> statement-breakpoint
ALTER TYPE "public"."auth_event_type" ADD VALUE 'wa_stop';--> statement-breakpoint
CREATE TABLE "whatsapp_channels" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"status" "whatsapp_status" NOT NULL,
	"phone_hmac" "bytea" NOT NULL,
	"code_hash" "bytea",
	"code_expires_at" timestamp with time zone,
	"code_attempts" smallint DEFAULT 0 NOT NULL,
	"verified_at" timestamp with time zone,
	"stopped_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "whatsapp_channels_hmac_length" CHECK (octet_length("whatsapp_channels"."phone_hmac") = 32),
	CONSTRAINT "whatsapp_channels_attempts" CHECK ("whatsapp_channels"."code_attempts" BETWEEN 0 AND 5)
);
--> statement-breakpoint
CREATE TABLE "whatsapp_messages" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "whatsapp_messages_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"user_id" uuid,
	"phone_hmac" "bytea" NOT NULL,
	"kind" "whatsapp_message_kind" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "alert_preferences" ADD COLUMN "whatsapp" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "sent_whatsapp_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "whatsapp_channels" ADD CONSTRAINT "whatsapp_channels_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "whatsapp_channels_phone_hmac_idx" ON "whatsapp_channels" USING btree ("phone_hmac");--> statement-breakpoint
CREATE INDEX "whatsapp_messages_user_idx" ON "whatsapp_messages" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "whatsapp_messages_phone_idx" ON "whatsapp_messages" USING btree ("phone_hmac","created_at");--> statement-breakpoint
CREATE INDEX "whatsapp_messages_created_idx" ON "whatsapp_messages" USING btree ("created_at");--> statement-breakpoint
-- WhatsApp is for the API and its worker only (app_rw). ingest_w gets nothing.
GRANT SELECT, INSERT, UPDATE, DELETE ON whatsapp_channels, whatsapp_messages TO app_rw;
