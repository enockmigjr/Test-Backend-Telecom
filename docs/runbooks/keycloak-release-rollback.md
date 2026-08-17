# Runbook — Release Keycloak-only, observabilité et refonte UI (réversible)

## Prérequis

- Backend, `frontend/`, `public-frontend/` sur les SHA du manifest `plans/reports/release-manifest-*.json`.
- Sauvegarde du realm avant rollout :
  `docker compose exec keycloak curl -s http://localhost:8080/admin/realms/telecom -H "Authorization: Bearer $TOKEN" > keycloak/import/backups/telecom-realm-{date}.json`
- Sauvegarde PostgreSQL disponible (voir `backups/` / Makefile).
- Secrets : `KEYCLOAK_ADMIN_PASSWORD`, `PUBLIC_SESSION_SECRET`, `AUTH_CSRF_SECRET`, `PUBLIC_SUPPORT_MASTER_KEYS`, `PUBLIC_SUPPORT_CONTACT_HASH_SECRET`.

## Ordre de rollout

1. Backend (auth Keycloak-only, sync événements, migrations 0020/0021) — **sans** DROP manuel.
2. Image Keycloak `telecom-keycloak` (thème refondu + realm events/brute force) — pilote 1 admin + 1 agent.
3. `frontend/` (console interne, dark mode).
4. `public-frontend/` (portail, marque).
5. Fenêtre de maintenance : pré-vol `refresh_tokens` puis migration 0020 (voir ci-dessous).

## Vérifications après chaque étape

- `pnpm run openapi:check` vert ; `frontend`: `pnpm contract:check` ; `public-frontend`: `pnpm contract:check`.
- Login SSO, logout, logout-all (révocation API admin + `jwt_user_bl`), WebSocket `/ws` connecté.
- `audit_logs` : événements `KEYCLOAK_*` visibles sans doublon après 2 cycles du cron.
- Grafana/Loki : requête `{service="keycloak"}` visible ; une erreur de login tracée en `level=error`.
- DOM : recherche « Keycloak » = 0 sur login, account, console, portail (Playwright + `rg`).

## Pré-vol avant le DROP de `refresh_tokens`

```bash
# Fenêtre configurée (défaut 14 jours)
export REFRESH_TOKENS_DROP_GRACE_DAYS=14
export DATABASE_URL=postgresql://telecom:...@postgres:5432/telecom_tickets
node scripts/check-refresh-tokens-drop.mjs
```

- Code 0 : aucune écriture récente → possible d'appliquer la migration gardée.
- Code 1 : des lignes récentes existent → attendre la fin de la fenêtre ou purger consciemment (jamais en aveugle).

La migration `0020_talented_millenium_guard.sql` refuse elle-même le DROP si la table contient des lignes (double garde).

## Rollback

- **IdP** : redéployer le tag image précédent et restaurer l'export realm de sauvegarde (re-import `--import-realm` en maintenance).
- **Events sync** : `KEYCLOAK_EVENTS_SYNC_CRON=disabled` puis redéployer le backend.
- **Dark mode / marque** : préférence utilisateur ; rollback = ancien build frontend.
- **DROP `refresh_tokens`** : jamais utilisé comme mécanisme de rollback (migration additive en amont, sauvegarde en aval). En cas de besoin de la table, la recréer depuis le snapshot 0019 puis restaurer les données depuis la sauvegarde.

## Alertes

- Échec de `KeycloakEventsService.sync` (log `Synchronisation des événements Keycloak impossible`).
- Quotas d'événements Keycloak (rétention 30 j) ; volume > 100 événements/cycle à surveiller.
- Verrouillage brute force (5 échecs/15 min) : comptes légitimes verrouillés → consulter la console Keycloak.
