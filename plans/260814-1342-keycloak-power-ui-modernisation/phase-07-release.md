# Phase 07 — Release progressive et réversible

## Statut
- Prévu — dépend de : phase 06 (contrats/tests/docs), D2/D5 actés (DROP `refresh_tokens` avec fenêtre env), D1/D6 actés ; D3/D4 abandonnés.
- Références : skill `release-rollout`, manifest existant `plans/reports/release-manifest-260811.json`, `docker-compose.yml` / `docker-compose.prod.yml`.

## Contexte
Le chantier touche l'IdP (realm, thème), le backend (auth, cron, migration) et deux frontends : la release doit être progressive (flags), réversible (image tag, realm export) et sans destruction non validée (table `refresh_tokens`).

## Vue d'ensemble
1. Manifest de release (SHA par dépôt, hash contrats/realm, image tag).
2. Ordre de rollout + flags.
3. DROP `refresh_tokens` conditionné (D2/D5) avec pré-vol.
4. Runbook rollback + drills de panne.
5. Checklist production.

## Exigences
- Aucun secret dans le manifest ou les logs.
- Rollback par flags et ancienne image, jamais par restauration destructive de données.
- DROP `refresh_tokens` exécuté uniquement après : fenêtre D5 sans écriture vérifiée par SQL sur chaque environnement, sauvegarde PostgreSQL disponible, fenêtre de maintenance.

## Architecture
- **Manifest** : `plans/reports/release-manifest-260814-{heure}-keycloak-power-ui-modernisation.json` : SHA par dépôt (backend, `frontend/`, `public-frontend/` — vérifier l'autonomie Git), hash `openapi.json`/`openapi.public.json`/schémas, hash `keycloak/import/telecom-realm.json`, tag image `telecom-keycloak:26.7.1-{sha8}`.
- **Flags** : dark mode = préférence utilisateur (pas de flag global) ; events sync = activé par défaut avec arrêt possible via `KEYCLOAK_EVENTS_SYNC_CRON` désactivé ; brute force = activé au niveau realm (D6).
- **Rollout** : 1) backend (auth/cron, sans DROP), 2) image Keycloak + realm (events/brute force, pilote), 3) frontend interne, 4) portail public, 5) fenêtre maintenance : pré-vol puis DROP `refresh_tokens` (D2/D5).
- **Rollback** : revenir au tag image précédent, restaurer l'export realm de sauvegarde (`keycloak/import/backups/telecom-realm-{date}.json` — à créer avant rollout), désactiver events sync par config ; le DROP n'est pas un mécanisme de rollback (migration additive en amont, sauvegarde en aval).

## Étapes
1. Vérifier les dépôts Git et collecter les SHA ; créer la sauvegarde realm avant rollout.
2. Écrire le manifest JSON (phase 06 fournit les hash).
3. Écrire `docs/runbooks/keycloak-release-rollback.md` : prérequis, commandes, vérifications, rollback par étape.
4. Exécuter le rollout pilote (1 admin + 1 agent) ; valider login, logout-all, dark mode, notifications WS.
5. Drills : panne Keycloak (login refusé avec message clair), backlog events (cron reprend et déduplique), verrouillage brute force (délai attendu).
6. Fenêtre D5 : pré-vol via `scripts/check-refresh-tokens-drop.mjs` (lit `REFRESH_TOKENS_DROP_GRACE_DAYS`, défaut 14) — `SELECT count(*) FROM refresh_tokens WHERE created_at > now() - interval '<grace> days'` = 0 sur tous les environnements —, sauvegarde PostgreSQL, exécution de `0020_drop-refresh-tokens.sql`, vérification 30 tables + démarrage API.
7. Checklist production : secrets `KEYCLOAK_ADMIN_PASSWORD`, HTTPS/Nginx, `KC_HOSTNAME` prod, quotas events, alertes cron (échec events sync), seuil brute force documenté.

## Fichiers
- **Créer** : `plans/reports/release-manifest-260814-{heure}-keycloak-power-ui-modernisation.json`, `docs/runbooks/keycloak-release-rollback.md`, `keycloak/import/backups/telecom-realm-{date}.json` (sauvegarde, hors Git si sensible).
- **Modifier** : `docs/deployment.md` (section release/rollback), `CHANGELOG.md`.

## Todo et tests
- [ ] SHA + hash collectés et manifest écrit
- [ ] Sauvegarde realm existante avant rollout
- [ ] Pilote validé (login/logout-all/WS/dark)
- [ ] Drills exécutés et rapportés (ou listés non exécutés)
- [ ] Pré-vol D5 via `REFRESH_TOKENS_DROP_GRACE_DAYS` = 0 écriture récente sur tous les environnements
- [ ] DROP exécuté en maintenance ; démarrage API + 30 tables vérifiés
- [ ] Runbook rollback relu et applicable

## Critères de succès
- Gate G atteinte : release manifestée, réversible, DROP `refresh_tokens` exécuté uniquement après validation D2/D5.
- Aucune donnée perdue hors périmètre validé ; rollback documenté et testé au moins sur l'environnement de préproduction.
