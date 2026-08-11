DO $$ BEGIN
 CREATE TYPE "public"."knowledge_status_enum" AS ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "support_knowledge_articles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"slug" varchar(160) NOT NULL,
	"title" varchar(255) NOT NULL,
	"summary" text,
	"content" text NOT NULL,
	"language" varchar(16) DEFAULT 'fr' NOT NULL,
	"status" "knowledge_status_enum" DEFAULT 'DRAFT' NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "support_knowledge_grants" (
	"article_id" uuid NOT NULL,
	"support_integration_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "support_knowledge_grants_article_id_support_integration_id_pk" PRIMARY KEY("article_id","support_integration_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "support_knowledge_versions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"article_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"title" varchar(255) NOT NULL,
	"summary" text,
	"content" text NOT NULL,
	"language" varchar(16) DEFAULT 'fr' NOT NULL,
	"created_by" uuid,
	"note" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "support_knowledge_grants" ADD CONSTRAINT "support_knowledge_grants_article_id_support_knowledge_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."support_knowledge_articles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "support_knowledge_grants" ADD CONSTRAINT "support_knowledge_grants_support_integration_id_support_integrations_id_fk" FOREIGN KEY ("support_integration_id") REFERENCES "public"."support_integrations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "support_knowledge_versions" ADD CONSTRAINT "support_knowledge_versions_article_id_support_knowledge_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."support_knowledge_articles"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_knowledge_articles_slug" ON "support_knowledge_articles" USING btree ("slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_knowledge_articles_status" ON "support_knowledge_articles" USING btree ("status","updated_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_knowledge_grants_integration" ON "support_knowledge_grants" USING btree ("support_integration_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_knowledge_versions_article_version" ON "support_knowledge_versions" USING btree ("article_id","version");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_knowledge_versions_article" ON "support_knowledge_versions" USING btree ("article_id","version");