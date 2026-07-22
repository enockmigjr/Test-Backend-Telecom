ALTER TABLE "tickets"
  ADD COLUMN IF NOT EXISTS "first_response_warning_sent_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "first_response_breached_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "resolution_warning_sent_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "resolution_breached_at" timestamp with time zone;

-- Avant cette migration, sla_breached ne suivait que l'échéance de résolution.
UPDATE "tickets"
SET "resolution_breached_at" = COALESCE("updated_at", "resolution_due_at", NOW())
WHERE "sla_breached" = true
  AND "resolution_breached_at" IS NULL;

CREATE INDEX IF NOT EXISTS "idx_tickets_first_response_sla_pending"
  ON "tickets" ("first_response_due_at")
  WHERE "deleted_at" IS NULL
    AND "first_response_at" IS NULL
    AND "first_response_breached_at" IS NULL
    AND "status" NOT IN ('RESOLVED', 'CLOSED', 'CANCELLED');

CREATE INDEX IF NOT EXISTS "idx_tickets_resolution_sla_pending"
  ON "tickets" ("resolution_due_at")
  WHERE "deleted_at" IS NULL
    AND "resolution_breached_at" IS NULL
    AND "sla_paused_at" IS NULL
    AND "status" NOT IN ('RESOLVED', 'CLOSED', 'CANCELLED');
