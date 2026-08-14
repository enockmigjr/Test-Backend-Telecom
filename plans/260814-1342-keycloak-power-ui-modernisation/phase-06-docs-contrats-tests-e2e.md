# Phase 06 — Documentation, contrats, tests et E2E

## Statut
- Prévu — dépend de : phases 01 à 05 terminées (code), Gate A par phase.
- Références : docs obsolètes vérifiées (`docs/database-schema.md:32`, `docs/environment-variables.md:187`, `docs/jobs-and-workers.md:45`, `docs/deployment.md:20,202`, `CONTRIBUTING.md:111`, `AGENTS.md` comptages 90/24).

## Contexte
Le nettoyage (phase 01) et l'observabilité (phase 02) rendent plusieurs documents faux (refresh_tokens, JWT locaux, SSO « en cours », jobs). Les comptages de tests annoncés (90 spec / 585 tests / 24 E2E-intégration) divergent du comptage statique du 14/08/2026 (89 spec, 15 e2e, 4 integration) : seule une exécution réelle tranche.

## Vue d'ensemble
1. Aligner toutes les docs .md sur l'état réel.
2. Ré-exporter et geler les contrats (OpenAPI + schémas frontends + hash).
3. Exécuter les suites complètes et rapporter les comptages réels.
4. E2E navigateur (console, portail, Keycloak) + recherche « Keycloak » = 0.
5. CHANGELOG + note mémoire ad hoc.

## Exigences
- Aucun chiffre inventé : chaque compte rendu cite la commande et sa sortie.
- `openapi:check`, `contract:check` (frontend + public-frontend) verts.
- AGENTS.md mis à jour (comptages, architecture Keycloak, marque) uniquement après vérification.
- Fichiers docs < 200 lignes autant que possible ; pas de copies `-v2`/`-enhanced`.

## Architecture
- **Docs backend** : `docs/database-schema.md` (30 tables après DROP `refresh_tokens`, `keycloak_subject_id` actif, 21 migrations), `docs/environment-variables.md` (section JWT réduite/supprimée, SSO « actif », sections Keycloak réduites : events, brute force, `KEYCLOAK_EVENTS_SYNC_CRON`, `REFRESH_TOKENS_DROP_GRACE_DAYS` ; recompter les variables), `docs/jobs-and-workers.md` (retirer la ligne TokenCleanup, ajouter KeycloakEventsSync toutes les 5 min), `docs/deployment.md` (retirer `JWT_REFRESH_SECRET`, mettre à jour troubleshooting), `CONTRIBUTING.md` (liste env), `docs/implementation-status.md`, `AGENTS.md`, `README.md` si incohérent.
- **Contrats** : `pnpm run openapi:check` (re-export + tests de contrat), `frontend`: `pnpm contract:check`, `public-frontend`: `pnpm contract:check` ; calculer les hash (`openapi.json`, `openapi.public.json`, schémas générés) pour le manifest de phase 07.
- **Tests** : `pnpm run test:all` (backend), `pnpm verify` (frontend), `pnpm verify` (public-frontend), Playwright (console + portail + thème Keycloak) ; rapport `plans/reports/test-260814-{heure}-keycloak-power-ui-modernisation.md`.
- **E2E Keycloak** : les parcours authentifiés (login, logout-all, verrouillage brute force, événements visibles dans `audit_logs`) passent par l'image `telecom-keycloak` rebuildée (phases 02/03) ; toute vérification non exécutée est listée comme **non vérifiée**.

## Étapes
1. Exécuter les suites complètes et écrire le rapport de test avec comptages exacts.
2. Mettre à jour les docs listées ; vérifier par `rg` l'absence de `refresh_tokens`, `JWT_REFRESH_SECRET`, « en cours » (SSO).
3. Re-export OpenAPI + `contract:check` ; enregistrer les hash.
4. Lancer les E2E navigateur (console, portail, widget, thème Keycloak) avec axe ; recherche « Keycloak » DOM = 0 ; screenshots.
5. Mettre à jour `AGENTS.md` (comptages réels, sections Keycloak/UI) et `docs/implementation-status.md`.
6. Ajouter l'entrée `CHANGELOG.md` et une note mémoire ad hoc `C:\Users\user\.codex\memories\extensions\ad_hoc\notes\20260814-{heure}-keycloak-power-ui-modernisation.md`.

## Fichiers
- **Modifier** : `docs/database-schema.md`, `docs/environment-variables.md`, `docs/jobs-and-workers.md`, `docs/deployment.md`, `docs/implementation-status.md`, `CONTRIBUTING.md`, `AGENTS.md`, `README.md`, `CHANGELOG.md` (+ tout `.md` citant les éléments supprimés, détecté par `rg`).
- **Créer** : `plans/reports/test-260814-{heure}-keycloak-power-ui-modernisation.md`, note mémoire ad hoc `C:\Users\user\.codex\memories\extensions\ad_hoc\notes\20260814-{heure}-keycloak-power-ui-modernisation.md`.

## Todo et tests
- [ ] `test:all` exécuté et rapporté (comptages réels vs AGENTS.md réconciliés)
- [ ] `verify` frontend + public-frontend verts
- [ ] `openapi:check` vert (115/139 ; 30/33) ; `contract:check` verts ; hash enregistrés
- [ ] E2E navigateur exécutés (ou liste explicite des non exécutés)
- [ ] `rg "refresh_tokens|JWT_REFRESH_SECRET|AUTH_PROVIDER|Keycloak (en cours)" docs AGENTS.md README.md` = 0
- [ ] Zéro « Keycloak » visible dans le DOM des trois surfaces
- [ ] CHANGELOG + note mémoire écrits

## Critères de succès
- Gate F atteinte : toutes les suites vertes avec preuves, docs alignées, contrats gelés et hashés.
- Aucune affirmation de succès non démontré : les E2E non lancés restent marqués « non vérifiés ».
