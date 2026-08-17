-- Migration 0020 : suppression de la table legacy `refresh_tokens` (Keycloak-only).
-- Garde absolue : le DROP est refusé si la table contient la moindre ligne.
-- La fenêtre de validation (REFRESH_TOKENS_DROP_GRACE_DAYS) est contrôlée en
-- amont par scripts/check-refresh-tokens-drop.mjs (phase 07), jamais ici.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'refresh_tokens'
  ) AND EXISTS (SELECT 1 FROM refresh_tokens) THEN
    RAISE EXCEPTION 'DROP refresh_tokens refuse : la table contient encore des lignes. Executer le pre-vol REFRESH_TOKENS_DROP_GRACE_DAYS avant.';
  END IF;
END $$;--> statement-breakpoint
DROP TABLE IF EXISTS "refresh_tokens";
