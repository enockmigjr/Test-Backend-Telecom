UPDATE "attachments"
SET "quarantine_deleted_at" = now()
WHERE "scan_status" = 'CLEAN' AND "object_key" NOT LIKE 'clean/%';
