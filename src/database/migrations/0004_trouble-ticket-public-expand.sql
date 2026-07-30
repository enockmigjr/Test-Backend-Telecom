DO $$ BEGIN
 CREATE TYPE "public"."actor_type_enum" AS ENUM('INTERNAL', 'EXTERNAL_REQUESTER', 'SYSTEM');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."attachment_scan_status_enum" AS ENUM('NOT_REQUIRED', 'PENDING', 'SCANNING', 'CLEAN', 'INFECTED', 'ERROR');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."conversation_status_enum" AS ENUM('OPEN', 'TICKET_CREATED', 'CLOSED', 'ABANDONED');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."delivery_status_enum" AS ENUM('PENDING', 'PROCESSING', 'DELIVERED', 'FAILED', 'DELIVERY_UNKNOWN');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."external_identity_type_enum" AS ENUM('EMAIL', 'PHONE', 'WORDPRESS');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."idempotency_subject_type_enum" AS ENUM('INTERNAL', 'EXTERNAL_REQUESTER', 'INTEGRATION');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."integration_status_enum" AS ENUM('DRAFT', 'ACTIVE', 'SUSPENDED');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."outbox_status_enum" AS ENUM('PENDING', 'PROCESSING', 'PUBLISHED', 'FAILED');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."support_channel_enum" AS ENUM('INTERNAL', 'WEB_PORTAL', 'WIDGET', 'WORDPRESS', 'EMAIL', 'WHATSAPP', 'API');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."support_message_direction_enum" AS ENUM('INBOUND', 'OUTBOUND');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."verification_challenge_status_enum" AS ENUM('PENDING', 'VERIFIED', 'EXPIRED', 'LOCKED');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "external_deliveries" (
	"id" uuid PRIMARY KEY NOT NULL,
	"outbox_event_id" uuid NOT NULL,
	"support_integration_id" uuid NOT NULL,
	"channel" "support_channel_enum" NOT NULL,
	"destination_key" varchar(180) NOT NULL,
	"status" "delivery_status_enum" DEFAULT 'PENDING' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"provider_message_id" varchar(255),
	"locked_at" timestamp with time zone,
	"locked_by" varchar(120),
	"delivered_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "external_identities" (
	"id" uuid PRIMARY KEY NOT NULL,
	"support_integration_id" uuid NOT NULL,
	"external_requester_id" uuid NOT NULL,
	"identity_type" "external_identity_type_enum" NOT NULL,
	"normalized_value_hash" varchar(128) NOT NULL,
	"encrypted_value" text NOT NULL,
	"provider_subject" varchar(255),
	"verified_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "external_requesters" (
	"id" uuid PRIMARY KEY NOT NULL,
	"support_integration_id" uuid NOT NULL,
	"display_name" varchar(160),
	"locale" varchar(16) DEFAULT 'fr' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_seen_at" timestamp with time zone,
	"anonymized_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "external_verification_challenges" (
	"id" uuid PRIMARY KEY NOT NULL,
	"support_integration_id" uuid NOT NULL,
	"external_requester_id" uuid,
	"identity_type" "external_identity_type_enum" NOT NULL,
	"contact_hash" varchar(128) NOT NULL,
	"encrypted_destination" text NOT NULL,
	"code_hash" varchar(128) NOT NULL,
	"status" "verification_challenge_status_enum" DEFAULT 'PENDING' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 5 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "support_integrations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"public_key" varchar(80) NOT NULL,
	"name" varchar(160) NOT NULL,
	"status" "integration_status_enum" DEFAULT 'DRAFT' NOT NULL,
	"allowed_origins" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"appearance" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"routing_policy" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"quota_policy" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"trust_policy" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"features" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "integration_credentials" (
	"id" uuid PRIMARY KEY NOT NULL,
	"support_integration_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"encrypted_secret" text NOT NULL,
	"encryption_key_version" integer NOT NULL,
	"active_from" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "trusted_devices" (
	"id" uuid PRIMARY KEY NOT NULL,
	"support_integration_id" uuid NOT NULL,
	"external_requester_id" uuid NOT NULL,
	"token_hash" varchar(128) NOT NULL,
	"policy_version" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "support_conversations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"support_integration_id" uuid NOT NULL,
	"external_requester_id" uuid,
	"ticket_id" uuid,
	"source_channel" "support_channel_enum" NOT NULL,
	"status" "conversation_status_enum" DEFAULT 'OPEN' NOT NULL,
	"current_state" varchar(80) DEFAULT 'START' NOT NULL,
	"context" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_message_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "support_messages" (
	"id" uuid PRIMARY KEY NOT NULL,
	"support_integration_id" uuid NOT NULL,
	"conversation_id" uuid NOT NULL,
	"ticket_comment_id" uuid,
	"actor_type" "actor_type_enum" NOT NULL,
	"user_id" uuid,
	"external_requester_id" uuid,
	"direction" "support_message_direction_enum" NOT NULL,
	"content" text,
	"channel_metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "outbox_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"support_integration_id" uuid,
	"aggregate_type" varchar(80) NOT NULL,
	"aggregate_id" uuid NOT NULL,
	"event_type" varchar(120) NOT NULL,
	"deduplication_key" varchar(180) NOT NULL,
	"payload" jsonb NOT NULL,
	"status" "outbox_status_enum" DEFAULT 'PENDING' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 10 NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_at" timestamp with time zone,
	"locked_by" varchar(120),
	"published_at" timestamp with time zone,
	"failed_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- Les index cibles doivent exister avant les FK composites qui garantissent le cloisonnement par intégration.
CREATE UNIQUE INDEX IF NOT EXISTS "uq_external_requesters_id_integration" ON "external_requesters" ("id", "support_integration_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_support_conversations_id_integration" ON "support_conversations" ("id", "support_integration_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_support_messages_id_integration" ON "support_messages" ("id", "support_integration_id");
--> statement-breakpoint
ALTER TABLE "attachments" ALTER COLUMN "uploaded_by" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "audit_logs" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "idempotency_records" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "tickets" ALTER COLUMN "created_by" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "ticket_assignments" ALTER COLUMN "assigned_by" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "ticket_comments" ALTER COLUMN "author_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "ticket_history" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "attachments" ADD COLUMN "support_message_id" uuid;--> statement-breakpoint
ALTER TABLE "attachments" ADD COLUMN "actor_type" "actor_type_enum" DEFAULT 'INTERNAL' NOT NULL;--> statement-breakpoint
ALTER TABLE "attachments" ADD COLUMN "external_requester_id" uuid;--> statement-breakpoint
ALTER TABLE "attachments" ADD COLUMN "support_integration_id" uuid;--> statement-breakpoint
ALTER TABLE "attachments" ADD COLUMN "scan_status" "attachment_scan_status_enum" DEFAULT 'NOT_REQUIRED' NOT NULL;--> statement-breakpoint
ALTER TABLE "attachments" ADD COLUMN "scanned_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "attachments" ADD COLUMN "scan_error" text;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD COLUMN "actor_type" "actor_type_enum" DEFAULT 'INTERNAL' NOT NULL;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD COLUMN "external_requester_id" uuid;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD COLUMN "support_integration_id" uuid;--> statement-breakpoint
ALTER TABLE "idempotency_records" ADD COLUMN "subject_type" "idempotency_subject_type_enum" DEFAULT 'INTERNAL' NOT NULL;--> statement-breakpoint
ALTER TABLE "idempotency_records" ADD COLUMN "external_requester_id" uuid;--> statement-breakpoint
ALTER TABLE "idempotency_records" ADD COLUMN "support_integration_id" uuid;--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN "opened_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN "requester_id" uuid;--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN "support_integration_id" uuid;--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN "source_channel" "support_channel_enum" DEFAULT 'INTERNAL' NOT NULL;--> statement-breakpoint
ALTER TABLE "ticket_assignments" ADD COLUMN "actor_type" "actor_type_enum" DEFAULT 'INTERNAL' NOT NULL;--> statement-breakpoint
ALTER TABLE "ticket_comments" ADD COLUMN "actor_type" "actor_type_enum" DEFAULT 'INTERNAL' NOT NULL;--> statement-breakpoint
ALTER TABLE "ticket_comments" ADD COLUMN "external_requester_id" uuid;--> statement-breakpoint
ALTER TABLE "ticket_comments" ADD COLUMN "support_integration_id" uuid;--> statement-breakpoint
ALTER TABLE "ticket_history" ADD COLUMN "actor_type" "actor_type_enum" DEFAULT 'INTERNAL' NOT NULL;--> statement-breakpoint
ALTER TABLE "ticket_history" ADD COLUMN "external_requester_id" uuid;--> statement-breakpoint
ALTER TABLE "ticket_history" ADD COLUMN "support_integration_id" uuid;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_tickets_id_integration" ON "tickets" ("id", "support_integration_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_ticket_comments_id_integration" ON "ticket_comments" ("id", "support_integration_id");
--> statement-breakpoint
-- Contraintes des nouvelles tables : elles sont vides au moment de l'expand et peuvent être validées immédiatement.
ALTER TABLE "external_verification_challenges" ADD CONSTRAINT "external_challenges_attempts_check"
  CHECK ("attempt_count" >= 0 AND "max_attempts" > 0 AND "attempt_count" <= "max_attempts");
--> statement-breakpoint
ALTER TABLE "external_verification_challenges" ADD CONSTRAINT "external_challenges_expiration_check"
  CHECK ("expires_at" > "created_at");
--> statement-breakpoint
ALTER TABLE "trusted_devices" ADD CONSTRAINT "trusted_devices_policy_version_check" CHECK ("policy_version" > 0);
--> statement-breakpoint
ALTER TABLE "integration_credentials" ADD CONSTRAINT "integration_credentials_versions_check"
  CHECK ("version" > 0 AND "encryption_key_version" > 0);
--> statement-breakpoint
ALTER TABLE "trusted_devices" ADD CONSTRAINT "trusted_devices_expiration_check" CHECK ("expires_at" > "created_at");
--> statement-breakpoint
ALTER TABLE "support_conversations" ADD CONSTRAINT "support_conversations_ticket_created_state_check"
  CHECK ("status" <> 'TICKET_CREATED' OR "ticket_id" IS NOT NULL);
--> statement-breakpoint
ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_actor_variant_check" CHECK (
  ("actor_type" = 'INTERNAL' AND "user_id" IS NOT NULL AND "external_requester_id" IS NULL)
  OR ("actor_type" = 'EXTERNAL_REQUESTER' AND "user_id" IS NULL AND "external_requester_id" IS NOT NULL)
  OR ("actor_type" = 'SYSTEM' AND "user_id" IS NULL AND "external_requester_id" IS NULL)
);
--> statement-breakpoint
ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_canonical_content_check"
  CHECK (num_nonnulls("content", "ticket_comment_id") = 1);
--> statement-breakpoint
ALTER TABLE "outbox_events" ADD CONSTRAINT "outbox_events_attempts_check"
  CHECK ("attempt_count" >= 0 AND "max_attempts" > 0 AND "attempt_count" <= "max_attempts");
--> statement-breakpoint
ALTER TABLE "external_deliveries" ADD CONSTRAINT "external_deliveries_attempts_check" CHECK ("attempt_count" >= 0);
--> statement-breakpoint
-- Les contraintes legacy sont actives sur toute nouvelle écriture mais évitent un scan bloquant des lignes historiques.
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_parent_check"
  CHECK (num_nonnulls("ticket_id", "comment_id", "internal_note_id", "support_message_id") = 1) NOT VALID;
--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_actor_variant_check" CHECK (
  ("actor_type" = 'INTERNAL' AND "uploaded_by" IS NOT NULL AND "external_requester_id" IS NULL)
  OR ("actor_type" = 'EXTERNAL_REQUESTER' AND "uploaded_by" IS NULL AND "external_requester_id" IS NOT NULL AND "support_integration_id" IS NOT NULL)
  OR ("actor_type" = 'SYSTEM' AND "uploaded_by" IS NULL AND "external_requester_id" IS NULL)
) NOT VALID;
--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_internal_note_actor_check"
  CHECK ("internal_note_id" IS NULL OR "actor_type" <> 'EXTERNAL_REQUESTER') NOT VALID;
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_variant_check" CHECK (
  ("actor_type" = 'INTERNAL' AND "user_id" IS NOT NULL AND "external_requester_id" IS NULL)
  OR ("actor_type" = 'EXTERNAL_REQUESTER' AND "user_id" IS NULL AND "external_requester_id" IS NOT NULL AND "support_integration_id" IS NOT NULL)
  OR ("actor_type" = 'SYSTEM' AND "user_id" IS NULL AND "external_requester_id" IS NULL)
) NOT VALID;
--> statement-breakpoint
ALTER TABLE "idempotency_records" ADD CONSTRAINT "idempotency_records_subject_variant_check" CHECK (
  ("subject_type" = 'INTERNAL' AND "user_id" IS NOT NULL AND "external_requester_id" IS NULL AND "support_integration_id" IS NULL)
  OR ("subject_type" = 'EXTERNAL_REQUESTER' AND "user_id" IS NULL AND "external_requester_id" IS NOT NULL AND "support_integration_id" IS NOT NULL)
  OR ("subject_type" = 'INTEGRATION' AND "user_id" IS NULL AND "external_requester_id" IS NULL AND "support_integration_id" IS NOT NULL)
) NOT VALID;
--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_actor_presence_check"
  CHECK (num_nonnulls("created_by", "opened_by_user_id", "requester_id") >= 1) NOT VALID;
--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_legacy_creator_check"
  CHECK ("created_by" IS NULL OR "opened_by_user_id" IS NULL OR "created_by" = "opened_by_user_id") NOT VALID;
--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_requester_integration_check"
  CHECK (num_nonnulls("requester_id", "support_integration_id") IN (0, 2)) NOT VALID;
--> statement-breakpoint
ALTER TABLE "ticket_assignments" ADD CONSTRAINT "ticket_assignments_actor_variant_check" CHECK (
  ("actor_type" = 'INTERNAL' AND "assigned_by" IS NOT NULL)
  OR ("actor_type" = 'SYSTEM' AND "assigned_by" IS NULL)
) NOT VALID;
--> statement-breakpoint
ALTER TABLE "ticket_comments" ADD CONSTRAINT "ticket_comments_actor_variant_check" CHECK (
  ("actor_type" = 'INTERNAL' AND "author_id" IS NOT NULL AND "external_requester_id" IS NULL)
  OR ("actor_type" = 'EXTERNAL_REQUESTER' AND "author_id" IS NULL AND "external_requester_id" IS NOT NULL AND "support_integration_id" IS NOT NULL)
  OR ("actor_type" = 'SYSTEM' AND "author_id" IS NULL AND "external_requester_id" IS NULL)
) NOT VALID;
--> statement-breakpoint
ALTER TABLE "ticket_history" ADD CONSTRAINT "ticket_history_actor_variant_check" CHECK (
  ("actor_type" = 'INTERNAL' AND "user_id" IS NOT NULL AND "external_requester_id" IS NULL)
  OR ("actor_type" = 'EXTERNAL_REQUESTER' AND "user_id" IS NULL AND "external_requester_id" IS NOT NULL AND "support_integration_id" IS NOT NULL)
  OR ("actor_type" = 'SYSTEM' AND "user_id" IS NULL AND "external_requester_id" IS NULL)
) NOT VALID;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "external_deliveries" ADD CONSTRAINT "external_deliveries_outbox_event_id_outbox_events_id_fk" FOREIGN KEY ("outbox_event_id") REFERENCES "public"."outbox_events"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "external_deliveries" ADD CONSTRAINT "external_deliveries_support_integration_id_support_integrations_id_fk" FOREIGN KEY ("support_integration_id") REFERENCES "public"."support_integrations"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "external_identities" ADD CONSTRAINT "external_identities_support_integration_id_support_integrations_id_fk" FOREIGN KEY ("support_integration_id") REFERENCES "public"."support_integrations"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "external_identities" ADD CONSTRAINT "external_identities_requester_integration_fk" FOREIGN KEY ("external_requester_id","support_integration_id") REFERENCES "public"."external_requesters"("id","support_integration_id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "external_requesters" ADD CONSTRAINT "external_requesters_support_integration_id_support_integrations_id_fk" FOREIGN KEY ("support_integration_id") REFERENCES "public"."support_integrations"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "external_verification_challenges" ADD CONSTRAINT "external_verification_challenges_support_integration_id_support_integrations_id_fk" FOREIGN KEY ("support_integration_id") REFERENCES "public"."support_integrations"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "external_verification_challenges" ADD CONSTRAINT "external_challenges_requester_integration_fk" FOREIGN KEY ("external_requester_id","support_integration_id") REFERENCES "public"."external_requesters"("id","support_integration_id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "integration_credentials" ADD CONSTRAINT "integration_credentials_support_integration_id_support_integrations_id_fk" FOREIGN KEY ("support_integration_id") REFERENCES "public"."support_integrations"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "trusted_devices" ADD CONSTRAINT "trusted_devices_support_integration_id_support_integrations_id_fk" FOREIGN KEY ("support_integration_id") REFERENCES "public"."support_integrations"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "trusted_devices" ADD CONSTRAINT "trusted_devices_requester_integration_fk" FOREIGN KEY ("external_requester_id","support_integration_id") REFERENCES "public"."external_requesters"("id","support_integration_id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "support_conversations" ADD CONSTRAINT "support_conversations_support_integration_id_support_integrations_id_fk" FOREIGN KEY ("support_integration_id") REFERENCES "public"."support_integrations"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "support_conversations" ADD CONSTRAINT "support_conversations_requester_integration_fk" FOREIGN KEY ("external_requester_id","support_integration_id") REFERENCES "public"."external_requesters"("id","support_integration_id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "support_conversations" ADD CONSTRAINT "support_conversations_ticket_integration_fk" FOREIGN KEY ("ticket_id","support_integration_id") REFERENCES "public"."tickets"("id","support_integration_id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_support_integration_id_support_integrations_id_fk" FOREIGN KEY ("support_integration_id") REFERENCES "public"."support_integrations"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_conversation_integration_fk" FOREIGN KEY ("conversation_id","support_integration_id") REFERENCES "public"."support_conversations"("id","support_integration_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_requester_integration_fk" FOREIGN KEY ("external_requester_id","support_integration_id") REFERENCES "public"."external_requesters"("id","support_integration_id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_comment_integration_fk" FOREIGN KEY ("ticket_comment_id","support_integration_id") REFERENCES "public"."ticket_comments"("id","support_integration_id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "outbox_events" ADD CONSTRAINT "outbox_events_support_integration_id_support_integrations_id_fk" FOREIGN KEY ("support_integration_id") REFERENCES "public"."support_integrations"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_external_deliveries_target" ON "external_deliveries" USING btree ("outbox_event_id","channel","destination_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_external_deliveries_claim" ON "external_deliveries" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_external_deliveries_integration" ON "external_deliveries" USING btree ("support_integration_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_external_identities_integration_type_hash" ON "external_identities" USING btree ("support_integration_id","identity_type","normalized_value_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_external_identities_requester" ON "external_identities" USING btree ("external_requester_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_external_requesters_integration" ON "external_requesters" USING btree ("support_integration_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_external_requesters_id_integration" ON "external_requesters" USING btree ("id","support_integration_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_external_requesters_integration_created" ON "external_requesters" USING btree ("support_integration_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_external_challenges_lookup" ON "external_verification_challenges" USING btree ("support_integration_id","identity_type","contact_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_external_challenges_expires_at" ON "external_verification_challenges" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_support_integrations_public_key" ON "support_integrations" USING btree ("public_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_support_integrations_status" ON "support_integrations" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_integration_credentials_version" ON "integration_credentials" USING btree ("support_integration_id","version");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_integration_credentials_integration" ON "integration_credentials" USING btree ("support_integration_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_trusted_devices_token_hash" ON "trusted_devices" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_trusted_devices_requester" ON "trusted_devices" USING btree ("support_integration_id","external_requester_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_trusted_devices_expires_at" ON "trusted_devices" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_support_conversations_integration_subject" ON "support_conversations" USING btree ("support_integration_id","external_requester_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_support_conversations_ticket" ON "support_conversations" USING btree ("ticket_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_support_conversations_id_integration" ON "support_conversations" USING btree ("id","support_integration_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_support_messages_conversation" ON "support_messages" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_support_messages_requester" ON "support_messages" USING btree ("support_integration_id","external_requester_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_support_messages_id_integration" ON "support_messages" USING btree ("id","support_integration_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_outbox_events_deduplication_key" ON "outbox_events" USING btree ("deduplication_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_outbox_events_claim" ON "outbox_events" USING btree ("status","available_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_outbox_events_aggregate" ON "outbox_events" USING btree ("aggregate_type","aggregate_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_outbox_events_integration" ON "outbox_events" USING btree ("support_integration_id","created_at");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "attachments" ADD CONSTRAINT "attachments_support_integration_id_support_integrations_id_fk" FOREIGN KEY ("support_integration_id") REFERENCES "public"."support_integrations"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "attachments" ADD CONSTRAINT "attachments_requester_integration_fk" FOREIGN KEY ("external_requester_id","support_integration_id") REFERENCES "public"."external_requesters"("id","support_integration_id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "attachments" ADD CONSTRAINT "attachments_support_message_integration_fk" FOREIGN KEY ("support_message_id","support_integration_id") REFERENCES "public"."support_messages"("id","support_integration_id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "attachments" ADD CONSTRAINT "attachments_ticket_integration_fk" FOREIGN KEY ("ticket_id","support_integration_id") REFERENCES "public"."tickets"("id","support_integration_id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "attachments" ADD CONSTRAINT "attachments_comment_integration_fk" FOREIGN KEY ("comment_id","support_integration_id") REFERENCES "public"."ticket_comments"("id","support_integration_id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_support_integration_id_support_integrations_id_fk" FOREIGN KEY ("support_integration_id") REFERENCES "public"."support_integrations"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_requester_integration_fk" FOREIGN KEY ("external_requester_id","support_integration_id") REFERENCES "public"."external_requesters"("id","support_integration_id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "idempotency_records" ADD CONSTRAINT "idempotency_records_support_integration_id_support_integrations_id_fk" FOREIGN KEY ("support_integration_id") REFERENCES "public"."support_integrations"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "idempotency_records" ADD CONSTRAINT "idempotency_records_requester_integration_fk" FOREIGN KEY ("external_requester_id","support_integration_id") REFERENCES "public"."external_requesters"("id","support_integration_id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tickets" ADD CONSTRAINT "tickets_opened_by_user_id_users_id_fk" FOREIGN KEY ("opened_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tickets" ADD CONSTRAINT "tickets_support_integration_id_support_integrations_id_fk" FOREIGN KEY ("support_integration_id") REFERENCES "public"."support_integrations"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tickets" ADD CONSTRAINT "tickets_requester_integration_fk" FOREIGN KEY ("requester_id","support_integration_id") REFERENCES "public"."external_requesters"("id","support_integration_id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ticket_comments" ADD CONSTRAINT "ticket_comments_support_integration_id_support_integrations_id_fk" FOREIGN KEY ("support_integration_id") REFERENCES "public"."support_integrations"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ticket_comments" ADD CONSTRAINT "ticket_comments_requester_integration_fk" FOREIGN KEY ("external_requester_id","support_integration_id") REFERENCES "public"."external_requesters"("id","support_integration_id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ticket_comments" ADD CONSTRAINT "ticket_comments_ticket_integration_fk" FOREIGN KEY ("ticket_id","support_integration_id") REFERENCES "public"."tickets"("id","support_integration_id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ticket_history" ADD CONSTRAINT "ticket_history_support_integration_id_support_integrations_id_fk" FOREIGN KEY ("support_integration_id") REFERENCES "public"."support_integrations"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ticket_history" ADD CONSTRAINT "ticket_history_requester_integration_fk" FOREIGN KEY ("external_requester_id","support_integration_id") REFERENCES "public"."external_requesters"("id","support_integration_id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ticket_history" ADD CONSTRAINT "ticket_history_ticket_integration_fk" FOREIGN KEY ("ticket_id","support_integration_id") REFERENCES "public"."tickets"("id","support_integration_id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_attachments_requester" ON "attachments" USING btree ("support_integration_id","external_requester_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_attachments_support_message" ON "attachments" USING btree ("support_message_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_audit_logs_requester" ON "audit_logs" USING btree ("support_integration_id","external_requester_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_idempotency_records_requester" ON "idempotency_records" USING btree ("support_integration_id","external_requester_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_tickets_opened_by" ON "tickets" USING btree ("opened_by_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_tickets_requester" ON "tickets" USING btree ("support_integration_id","requester_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_tickets_id_integration" ON "tickets" USING btree ("id","support_integration_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ticket_assignments_ticket" ON "ticket_assignments" USING btree ("ticket_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_comments_requester" ON "ticket_comments" USING btree ("support_integration_id","external_requester_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_ticket_comments_id_integration" ON "ticket_comments" USING btree ("id","support_integration_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ticket_history_requester" ON "ticket_history" USING btree ("support_integration_id","external_requester_id");
