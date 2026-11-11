CREATE TYPE "public"."article_category" AS ENUM('dasar', 'prediksi', 'arif-net', 'keterbatasan');--> statement-breakpoint
CREATE TYPE "public"."artifact_status" AS ENUM('pending', 'active', 'retired', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."eval_status" AS ENUM('available', 'partial', 'not_tested');--> statement-breakpoint
CREATE TYPE "public"."ingest_status" AS ENUM('running', 'succeeded', 'partial', 'failed');--> statement-breakpoint
CREATE TYPE "public"."market_status" AS ENUM('available', 'coming_soon');--> statement-breakpoint
CREATE TYPE "public"."model_coverage" AS ENUM('covered', 'pending');--> statement-breakpoint
CREATE TYPE "public"."price_source" AS ENUM('seed_csv', 'pihps');--> statement-breakpoint
CREATE TABLE "articles" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "articles_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"slug" text NOT NULL,
	"category" "article_category" NOT NULL,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"body_md" text NOT NULL,
	"reading_minutes" smallint NOT NULL,
	"published_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "articles_slug_unique" UNIQUE("slug"),
	CONSTRAINT "articles_slug_format" CHECK ("articles"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
	CONSTRAINT "articles_reading_minutes_positive" CHECK ("articles"."reading_minutes" > 0),
	CONSTRAINT "articles_body_size" CHECK (length("articles"."body_md") <= 100000)
);
--> statement-breakpoint
CREATE TABLE "commodities" (
	"id" smallint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "commodities_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 32767 START WITH 1 CACHE 1),
	"code" text NOT NULL,
	"name" text NOT NULL,
	"source_ref" text,
	"unit" text DEFAULT 'kg' NOT NULL,
	"model_coverage" "model_coverage" NOT NULL,
	"sort_order" smallint NOT NULL,
	CONSTRAINT "commodities_code_unique" UNIQUE("code"),
	CONSTRAINT "commodities_sourceRef_unique" UNIQUE("source_ref"),
	CONSTRAINT "commodities_sortOrder_unique" UNIQUE("sort_order"),
	CONSTRAINT "commodities_code_format" CHECK ("commodities"."code" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
	CONSTRAINT "commodities_unit_kg" CHECK ("commodities"."unit" = 'kg')
);
--> statement-breakpoint
CREATE TABLE "forecast_artifacts" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "forecast_artifacts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"bundle_id" text NOT NULL,
	"model_name" text NOT NULL,
	"model_version" text NOT NULL,
	"data_version" text NOT NULL,
	"preprocess_version" text NOT NULL,
	"data_cutoff" timestamp with time zone NOT NULL,
	"issued_at" timestamp with time zone NOT NULL,
	"checksum_sha256" text NOT NULL,
	"status" "artifact_status" DEFAULT 'pending' NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "forecast_artifacts_bundleId_unique" UNIQUE("bundle_id"),
	CONSTRAINT "forecast_artifacts_checksum_hex" CHECK ("forecast_artifacts"."checksum_sha256" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "forecast_artifacts_versions_present" CHECK (length("forecast_artifacts"."model_version") > 0 AND length("forecast_artifacts"."data_version") > 0 AND length("forecast_artifacts"."preprocess_version") > 0)
);
--> statement-breakpoint
CREATE TABLE "forecasts" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "forecasts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"artifact_id" bigint NOT NULL,
	"market_id" smallint NOT NULL,
	"commodity_id" smallint NOT NULL,
	"base_date" date NOT NULL,
	"horizon_days" smallint NOT NULL,
	"q10_change" numeric(9, 6),
	"q50_change" numeric(9, 6),
	"q90_change" numeric(9, 6),
	"q10_price_idr" integer,
	"q50_price_idr" integer,
	"q90_price_idr" integer,
	"eval_status" "eval_status" NOT NULL,
	CONSTRAINT "forecasts_artifact_market_commodity_horizon" UNIQUE("artifact_id","market_id","commodity_id","horizon_days"),
	CONSTRAINT "forecasts_horizon_allowed" CHECK ("forecasts"."horizon_days" IN (1, 3, 7, 14, 30, 90, 180, 365)),
	CONSTRAINT "forecasts_change_monotonic" CHECK ("forecasts"."q10_change" <= "forecasts"."q50_change" AND "forecasts"."q50_change" <= "forecasts"."q90_change"),
	CONSTRAINT "forecasts_price_monotonic" CHECK ("forecasts"."q10_price_idr" <= "forecasts"."q50_price_idr" AND "forecasts"."q50_price_idr" <= "forecasts"."q90_price_idr"),
	CONSTRAINT "forecasts_price_positive" CHECK ("forecasts"."q10_price_idr" > 0 AND "forecasts"."q50_price_idr" > 0 AND "forecasts"."q90_price_idr" > 0)
);
--> statement-breakpoint
CREATE TABLE "ingest_runs" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "ingest_runs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"source" "price_source" NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"status" "ingest_status" NOT NULL,
	"rows_inserted" integer DEFAULT 0 NOT NULL,
	"rows_skipped" integer DEFAULT 0 NOT NULL,
	"rows_rejected" integer DEFAULT 0 NOT NULL,
	"error" text,
	CONSTRAINT "ingest_runs_counts_non_negative" CHECK ("ingest_runs"."rows_inserted" >= 0 AND "ingest_runs"."rows_skipped" >= 0 AND "ingest_runs"."rows_rejected" >= 0)
);
--> statement-breakpoint
CREATE TABLE "markets" (
	"id" smallint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "markets_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 32767 START WITH 1 CACHE 1),
	"code" text NOT NULL,
	"name" text NOT NULL,
	"city" text NOT NULL,
	"status" "market_status" NOT NULL,
	CONSTRAINT "markets_code_unique" UNIQUE("code"),
	CONSTRAINT "markets_code_format" CHECK ("markets"."code" ~ '^[A-Z]{4}$')
);
--> statement-breakpoint
CREATE TABLE "price_observations" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "price_observations_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"market_id" smallint NOT NULL,
	"commodity_id" smallint NOT NULL,
	"observed_on" date NOT NULL,
	"price_idr" integer NOT NULL,
	"source" "price_source" NOT NULL,
	"ingest_run_id" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "price_observations_market_commodity_day" UNIQUE("market_id","commodity_id","observed_on"),
	CONSTRAINT "price_observations_price_positive" CHECK ("price_observations"."price_idr" > 0)
);
--> statement-breakpoint
ALTER TABLE "forecasts" ADD CONSTRAINT "forecasts_artifact_id_forecast_artifacts_id_fk" FOREIGN KEY ("artifact_id") REFERENCES "public"."forecast_artifacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forecasts" ADD CONSTRAINT "forecasts_market_id_markets_id_fk" FOREIGN KEY ("market_id") REFERENCES "public"."markets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forecasts" ADD CONSTRAINT "forecasts_commodity_id_commodities_id_fk" FOREIGN KEY ("commodity_id") REFERENCES "public"."commodities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_observations" ADD CONSTRAINT "price_observations_market_id_markets_id_fk" FOREIGN KEY ("market_id") REFERENCES "public"."markets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_observations" ADD CONSTRAINT "price_observations_commodity_id_commodities_id_fk" FOREIGN KEY ("commodity_id") REFERENCES "public"."commodities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_observations" ADD CONSTRAINT "price_observations_ingest_run_id_ingest_runs_id_fk" FOREIGN KEY ("ingest_run_id") REFERENCES "public"."ingest_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "forecast_artifacts_one_active_per_model" ON "forecast_artifacts" USING btree ("model_name") WHERE "forecast_artifacts"."status" = 'active';