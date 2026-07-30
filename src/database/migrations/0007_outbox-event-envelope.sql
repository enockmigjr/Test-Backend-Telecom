ALTER TABLE "outbox_events" ADD COLUMN IF NOT EXISTS "mutation_id" uuid;
--> statement-breakpoint
ALTER TABLE "outbox_events" ADD COLUMN IF NOT EXISTS "schema_version" integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE "outbox_events" ADD COLUMN IF NOT EXISTS "actor_type" "actor_type_enum";
--> statement-breakpoint
ALTER TABLE "outbox_events" ADD COLUMN IF NOT EXISTS "user_id" uuid;
--> statement-breakpoint
ALTER TABLE "outbox_events" ADD COLUMN IF NOT EXISTS "external_requester_id" uuid;
--> statement-breakpoint
UPDATE "outbox_events"
SET "mutation_id" = "id", "actor_type" = 'SYSTEM'
WHERE "mutation_id" IS NULL OR "actor_type" IS NULL;
--> statement-breakpoint
ALTER TABLE "outbox_events" ALTER COLUMN "mutation_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "outbox_events" ALTER COLUMN "actor_type" SET NOT NULL;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "outbox_events" ADD CONSTRAINT "outbox_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "outbox_events" ADD CONSTRAINT "outbox_events_requester_integration_fk" FOREIGN KEY ("external_requester_id","support_integration_id") REFERENCES "public"."external_requesters"("id","support_integration_id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "outbox_events" ADD CONSTRAINT "outbox_events_actor_variant_check" CHECK (
   ("actor_type" = 'INTERNAL' AND "user_id" IS NOT NULL AND "external_requester_id" IS NULL)
   OR ("actor_type" = 'EXTERNAL_REQUESTER' AND "user_id" IS NULL
     AND "external_requester_id" IS NOT NULL AND "support_integration_id" IS NOT NULL)
   OR ("actor_type" = 'SYSTEM' AND "user_id" IS NULL AND "external_requester_id" IS NULL)
 );
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "outbox_events" ADD CONSTRAINT "outbox_events_schema_version_check" CHECK ("schema_version" > 0);
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_outbox_events_mutation_event_version" ON "outbox_events" USING btree ("mutation_id","event_type","schema_version");
