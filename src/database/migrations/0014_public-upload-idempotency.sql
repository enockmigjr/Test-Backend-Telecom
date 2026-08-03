ALTER TABLE "attachments" ADD COLUMN "public_upload_key_hash" varchar(64);--> statement-breakpoint
ALTER TABLE "attachments" ADD COLUMN "public_upload_fingerprint" varchar(64);--> statement-breakpoint
ALTER TABLE "attachments" ADD COLUMN "public_upload_idempotency_expires_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_attachments_public_upload_key" ON "attachments" USING btree ("public_upload_key_hash");
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_public_upload_idempotency_check"
CHECK (num_nonnulls("public_upload_key_hash", "public_upload_fingerprint", "public_upload_idempotency_expires_at") IN (0, 3));
