CREATE TABLE IF NOT EXISTS "public_bootstrap_grants" (
	"id" uuid PRIMARY KEY NOT NULL,
	"support_integration_id" uuid NOT NULL,
	"external_requester_id" uuid NOT NULL,
	"trusted_device_id" uuid NOT NULL,
	"code_hash" varchar(128) NOT NULL,
	"audience" varchar(160) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "public_bootstrap_grants" ADD CONSTRAINT "public_bootstrap_grants_integration_fk" FOREIGN KEY ("support_integration_id") REFERENCES "public"."support_integrations"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "public_bootstrap_grants" ADD CONSTRAINT "public_bootstrap_grants_requester_integration_fk" FOREIGN KEY ("external_requester_id","support_integration_id") REFERENCES "public"."external_requesters"("id","support_integration_id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "public_bootstrap_grants" ADD CONSTRAINT "public_bootstrap_grants_device_subject_fk" FOREIGN KEY ("trusted_device_id","support_integration_id","external_requester_id") REFERENCES "public"."trusted_devices"("id","support_integration_id","external_requester_id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_public_bootstrap_grants_code_hash" ON "public_bootstrap_grants" USING btree ("code_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_public_bootstrap_grants_expires_at" ON "public_bootstrap_grants" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_trusted_devices_subject" ON "trusted_devices" USING btree ("id","support_integration_id","external_requester_id");--> statement-breakpoint
ALTER TABLE "public_bootstrap_grants" ADD CONSTRAINT "public_bootstrap_grants_expiration_check"
  CHECK ("expires_at" > "created_at");
