ALTER TABLE "ticket_comments" ADD COLUMN "corrects_comment_id" uuid;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ticket_comments" ADD CONSTRAINT "ticket_comments_correction_integration_fk" FOREIGN KEY ("corrects_comment_id","support_integration_id") REFERENCES "public"."ticket_comments"("id","support_integration_id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_comments_correction" ON "ticket_comments" USING btree ("corrects_comment_id");
--> statement-breakpoint
ALTER TABLE "ticket_comments" ADD CONSTRAINT "ticket_comments_correction_self_check"
CHECK ("corrects_comment_id" IS NULL OR "corrects_comment_id" <> "id");
