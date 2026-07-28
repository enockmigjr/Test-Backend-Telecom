ALTER TABLE "refresh_tokens" ADD COLUMN IF NOT EXISTS "family_id" uuid;--> statement-breakpoint
UPDATE "refresh_tokens" SET "family_id" = "id" WHERE "family_id" IS NULL;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ALTER COLUMN "family_id" SET NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_refresh_tokens_family" ON "refresh_tokens" USING btree ("family_id");
