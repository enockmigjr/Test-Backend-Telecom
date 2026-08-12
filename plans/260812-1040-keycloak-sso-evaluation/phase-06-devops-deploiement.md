# Phase 06 — DevOps : déploiement facile

## Objectif

Rendre le déploiement (local et cible production) reproductible : conteneurs, images, env, données, base de données, backups.

## Livré en phase 01

- `Makefile` racine : env, up, down, build, restart, logs, ps, health, migrate, seed, db-reset, test, unit, e2e, lint, typecheck, openapi, db-shell, redis-shell, mailpit, clean (protégé).

## Workflow (suite)

1. **Scripts PowerShell** équivalents (`scripts/dev.ps1`) pour Windows sans `make`.
2. **Env** : `.env.example` complet par service (backend, frontend, public-frontend, keycloak) + vérification `make env`.
3. **Migrations** : `db:migrate` auto au démarrage de l'API (ou étape explicite dans le compose) ; seed optionnel via variable d'env (`SEED_ON_START=true`).
4. **Production (si validée)** : build multi-étapes des images (déjà présents), push registry, `docker-compose.prod.yml` (HTTPS via nginx + certbot ou proxy), backup PostgreSQL (script cron + pg_dump), restauration documentée, healthchecks.
5. **Keycloak** (phase 07) : service compose dédié + import realm au premier démarrage.

## Fichiers

- `Makefile`, `scripts/dev.ps1`, `scripts/backup-db.sh`, `docker-compose.prod.yml`, `nginx/*`

## Risques

- Secrets dans l'env : jamais commités (`.env` ignoré, `.env.example` documenté).
- Migration au démarrage : idempotente (déjà le cas via drizzle).

## Critères de validation

- `make env && make up && make migrate && make seed` sur base vierge → API saine, dashboards peuplés.
- Backup/restore PostgreSQL testé (données rechargées).
- Les trois dépôts se déploient avec les mêmes commandes.

## Tests

- Smoke script : santé API, login, une requête dashboard.
- (Prod) test de restauration après perte simulée du volume.
## Statut de la phase
- FAIT (pouss�) : Makefile de base. RESTE : scripts PowerShell, backup/restore, compose prod.
