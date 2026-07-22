CREATE TABLE IF NOT EXISTS "idempotency_records" (
	"key_hash" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"method" text NOT NULL,
	"path" text NOT NULL,
	"fingerprint" text NOT NULL,
	"status_code" integer,
	"response_body" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "idempotency_records" ADD CONSTRAINT "idempotency_records_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_idempotency_records_expires_at" ON "idempotency_records" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_idempotency_records_user_id" ON "idempotency_records" USING btree ("user_id");