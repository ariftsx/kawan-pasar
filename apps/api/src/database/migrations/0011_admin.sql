ALTER TYPE "public"."audit_action" ADD VALUE 'admin_grant';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'admin_revoke';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'role_approve';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'admin_confirm';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'article_save';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'article_publish';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'article_unpublish';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'article_restore';--> statement-breakpoint
ALTER TYPE "public"."notification_kind" ADD VALUE 'role_decision';--> statement-breakpoint
CREATE TABLE "article_revisions" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "article_revisions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"article_id" bigint NOT NULL,
	"revision" integer NOT NULL,
	"category" "article_category" NOT NULL,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"body_md" text NOT NULL,
	"reading_minutes" smallint NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "article_revisions_article_revision" UNIQUE("article_id","revision"),
	CONSTRAINT "article_revisions_body_size" CHECK (length("article_revisions"."body_md") <= 100000)
);
--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN "revision" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN "updated_by" uuid;--> statement-breakpoint
ALTER TABLE "article_revisions" ADD CONSTRAINT "article_revisions_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_revisions" ADD CONSTRAINT "article_revisions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- The current text of every existing article becomes its revision 1.
INSERT INTO article_revisions (article_id, revision, category, title, summary, body_md, reading_minutes, created_at)
  SELECT id, 1, category, title, summary, body_md, reading_minutes, updated_at FROM articles;--> statement-breakpoint
-- Revisions are history: the app adds them and reads them, never changes or deletes them.
GRANT SELECT, INSERT ON article_revisions TO app_rw;
