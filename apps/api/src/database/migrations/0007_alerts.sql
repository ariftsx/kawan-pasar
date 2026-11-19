CREATE TYPE "public"."alert_direction" AS ENUM('above', 'below');--> statement-breakpoint
CREATE TYPE "public"."notification_kind" AS ENUM('unusual_move', 'forecast_rise', 'price_threshold', 'weekly');--> statement-breakpoint
ALTER TYPE "public"."auth_token_purpose" ADD VALUE 'weekly_unsubscribe';--> statement-breakpoint
CREATE TABLE "alert_preferences" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"in_app" boolean DEFAULT true NOT NULL,
	"weekly" boolean DEFAULT false NOT NULL,
	"unusual_move" boolean DEFAULT true NOT NULL,
	"forecast_rise" boolean DEFAULT true NOT NULL,
	"price_threshold" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "alert_watches" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "alert_watches_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"user_id" uuid NOT NULL,
	"market_id" smallint NOT NULL,
	"commodity_id" smallint NOT NULL,
	"threshold_idr" integer,
	"direction" "alert_direction",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "alert_watches_user_market_commodity" UNIQUE("user_id","market_id","commodity_id"),
	CONSTRAINT "alert_watches_threshold" CHECK (("alert_watches"."threshold_idr" IS NULL AND "alert_watches"."direction" IS NULL) OR ("alert_watches"."threshold_idr" BETWEEN 1 AND 10000000 AND "alert_watches"."direction" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "notifications_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"user_id" uuid NOT NULL,
	"kind" "notification_kind" NOT NULL,
	"market_id" smallint,
	"commodity_id" smallint,
	"data_date" date NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"link" text,
	"model_version" text,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notifications_once" UNIQUE NULLS NOT DISTINCT("user_id","kind","commodity_id","data_date"),
	CONSTRAINT "notifications_title_length" CHECK (length("notifications"."title") BETWEEN 1 AND 160),
	CONSTRAINT "notifications_body_length" CHECK (length("notifications"."body") BETWEEN 1 AND 1200),
	CONSTRAINT "notifications_link_relative" CHECK ("notifications"."link" IS NULL OR "notifications"."link" ~ '^/[a-z0-9][a-z0-9/?=&._-]*$')
);
--> statement-breakpoint
ALTER TABLE "alert_preferences" ADD CONSTRAINT "alert_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_watches" ADD CONSTRAINT "alert_watches_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_watches" ADD CONSTRAINT "alert_watches_market_id_markets_id_fk" FOREIGN KEY ("market_id") REFERENCES "public"."markets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_watches" ADD CONSTRAINT "alert_watches_commodity_id_commodities_id_fk" FOREIGN KEY ("commodity_id") REFERENCES "public"."commodities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_market_id_markets_id_fk" FOREIGN KEY ("market_id") REFERENCES "public"."markets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_commodity_id_commodities_id_fk" FOREIGN KEY ("commodity_id") REFERENCES "public"."commodities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "alert_watches_market_commodity_idx" ON "alert_watches" USING btree ("market_id","commodity_id");--> statement-breakpoint
CREATE INDEX "notifications_user_created_idx" ON "notifications" USING btree ("user_id","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "notifications_unread_idx" ON "notifications" USING btree ("user_id") WHERE "notifications"."read_at" IS NULL;--> statement-breakpoint
CREATE INDEX "notifications_created_idx" ON "notifications" USING btree ("created_at");--> statement-breakpoint
-- Alerts are for the API and its worker only (same role, app_rw). ingest_w gets nothing.
GRANT SELECT, INSERT, UPDATE, DELETE ON alert_preferences, alert_watches, notifications TO app_rw;
