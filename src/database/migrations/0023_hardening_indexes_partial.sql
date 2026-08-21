-- Hardening post-audit 20/08 : index partiels et uniques pour cloisonnement et reprise email
-- users.email : passer en unique partiel WHERE deleted_at IS NULL (recréation après échec Keycloak)
-- users.keycloak_subject_id : unique partiel WHERE NOT NULL (évite doublon, accélère hot path)
DROP INDEX IF EXISTS "idx_users_email";
DROP INDEX IF EXISTS "users_email_unique";
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_email_unique";
CREATE UNIQUE INDEX "idx_users_email" ON "users" ("email") WHERE "deleted_at" IS NULL;
CREATE UNIQUE INDEX "idx_users_keycloak_subject" ON "users" ("keycloak_subject_id") WHERE "keycloak_subject_id" IS NOT NULL;

-- external_delivery : index pour rejeu FAILED/UNKNOWN (déjà couvert, mais s'assurer)
-- outbox / attachments non touchés dans cette migration (additif seul)
