-- Reprise additive des acteurs historiques. Aucune colonne legacy n'est supprimée.
UPDATE "tickets"
SET "opened_by_user_id" = "created_by"
WHERE "opened_by_user_id" IS NULL AND "created_by" IS NOT NULL;
--> statement-breakpoint
UPDATE "ticket_comments" SET "actor_type" = 'INTERNAL' WHERE "actor_type" IS NULL AND "author_id" IS NOT NULL;
--> statement-breakpoint
UPDATE "ticket_history" SET "actor_type" = 'INTERNAL' WHERE "actor_type" IS NULL AND "user_id" IS NOT NULL;
--> statement-breakpoint
UPDATE "attachments" SET "actor_type" = 'INTERNAL' WHERE "actor_type" IS NULL AND "uploaded_by" IS NOT NULL;
--> statement-breakpoint
UPDATE "audit_logs" SET "actor_type" = 'INTERNAL' WHERE "actor_type" IS NULL AND "user_id" IS NOT NULL;
--> statement-breakpoint
UPDATE "ticket_assignments" SET "actor_type" = 'INTERNAL' WHERE "actor_type" IS NULL AND "assigned_by" IS NOT NULL;
--> statement-breakpoint
UPDATE "idempotency_records"
SET "subject_type" = 'INTERNAL'
WHERE "subject_type" IS NULL AND "user_id" IS NOT NULL;
