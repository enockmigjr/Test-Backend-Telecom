# Plan — Keycloak-only, observabilité Keycloak, UI moderne et nettoyage

## Statut
- État : plan révisé le 14/08/2026 après retour utilisateur ; **aucune implémentation**.
- Décisions utilisateur actées : D1 (marque KAMGOKO ITSM + logo), D2 (suppression `refresh_tokens` après vérification de tous les liens, Keycloak-only), D5 (fenêtre DROP via variable d'environnement), D6 (brute force 5 échecs/15 min) ; D3 (step-up) et D4 (passkeys) **abandonnés**.
- Périmètre Keycloak réduit : **uniquement observabilité (logs, traces, erreurs) + protection brute force** ; aucun autre enrichissement.
- Rapports intermédiaires scout/research/red-team supprimés à la demande utilisateur ; les faits vérifiés sont repris dans les phases.
- Worktree : propre (aucune modification de code) ; seuls les livrables `plans/` sont non suivis.

## Objectif
Passer l'authentification en **Keycloak-only** (suppression HS256, `AUTH_PROVIDER`, env JWT locaux, table `refresh_tokens` après vérification exhaustive des liens), rendre les **logs/traces/erreurs Keycloak visibles** (événements → `audit_logs` + observabilité), activer la **protection brute force**, moderniser les trois surfaces UI dans un style sobre type Vercel **sans mention visible de « Keycloak »** — sans casser le contrat OpenAPI.

## Décisions d'exécution
1. Contrats d'abord : aucun endpoint OpenAPI nouveau ; comptages re-vérifiés le 14/08/2026 = 115 chemins / 139 opérations (`openapi.json`), 30 chemins / 33 opérations (`openapi.public.json`).
2. Keycloak reste l'IdP unique : suppression de la branche HS256, d'`AUTH_PROVIDER` et des secrets JWT locaux **après** migration du WebSocket `/ws` vers RS256 et application de `isRevoked` aux jetons Keycloak.
3. Hors périmètre Keycloak : groups/mappers OIDC, step-up ACR/OTP, WebAuthn/passkeys, organizations, identity brokering, fine-grained admin permissions v1.
4. Observabilité : events/admin events Keycloak synchronisés vers `audit_logs` (déduplication `source_event_id`), logs/traces Keycloak visibles dans Loki/Grafana, brute force realm activé (D6).
5. `refresh_tokens` : vérification exhaustive des références (code, migrations, seed, tests, docs, compose, CI) puis suppression du code et migration gardée ; DROP final conditionné à la fenêtre `REFRESH_TOKENS_DROP_GRACE_DAYS` (défaut 14, D5).
6. « Sans mention de Keycloak » = textes visibles uniquement ; les noms internes (routes `/api/auth/keycloak/*`, variables, services) restent.
7. TypeScript strict, zéro `any`/`@ts-ignore`, fichiers < 200 lignes, tout en français.

## Séquence
1. [Phase 00 — Cadrage et décisions](./phase-00-cadrage-decisions.md)
2. [Phase 01 — Nettoyage backend legacy (Keycloak-only)](./phase-01-nettoyage-backend-legacy.md)
3. [Phase 02 — Observabilité Keycloak (logs/traces/erreurs) + brute force](./phase-02-enrichissement-keycloak.md)
4. [Phase 03 — Refonte thème Keycloakify](./phase-03-refonte-theme-keycloakify.md)
5. [Phase 04 — Refonte console interne + dark mode](./phase-04-refonte-console-interne.md)
6. [Phase 05 — Portail public](./phase-05-portail-public.md)
7. [Phase 06 — Docs, contrats, tests, E2E](./phase-06-docs-contrats-tests-e2e.md)
8. [Phase 07 — Release](./phase-07-release.md)

## Chemin critique
`00 → 01 → 02 → 03 → 04 → 05 → 06 → 07`
- Parallélisable : 04/05 après 01 ; 06 démarre après 02.
- Bloquant : 01 avant toute suppression HS256 ; 02 après 01 ; D1 (acté) avant 03/04/05 ; D2/D5 (actés) avant le DROP `refresh_tokens`.

## Gates absolues
- **Gate A (chaque phase)** : build + lint + tests ciblés verts, `openapi:check` sans diff, zéro `any`/`@ts-ignore`, fichiers < 200 lignes.
- **Gate B (fin 01)** : WebSocket `/ws` authentifié avec un jeton RS256 réel ; `isRevoked` appliqué aux jetons Keycloak ; zéro référence HS256/`AUTH_PROVIDER`/`JWT_REFRESH_*` ; liens `refresh_tokens` vérifiés puis supprimés du code.
- **Gate C (fin 02)** : événements Keycloak dédupliqués dans `audit_logs` (2 exécutions sans doublon) ; brute force realm actif (5/15 min) ; logs/traces Keycloak visibles dans Loki/Grafana.
- **Gate D (fin 03)** : zéro texte « Keycloak » dans le DOM login/account/update-password ; image `telecom-keycloak` rebuildée et parcours testés.
- **Gate E (fin 04/05)** : dark mode contrasté (axe), préférence persistée, zéro mention Keycloak visible.
- **Gate F (fin 06)** : `test:all` + `verify` frontends verts avec comptages réels ; docs alignées ; contrats hashés.
- **Gate G (fin 07)** : manifest release par SHA + rollout progressif + rollback documenté ; DROP `refresh_tokens` seulement après pré-vol `REFRESH_TOKENS_DROP_GRACE_DAYS` + sauvegarde.

## Décisions requises avant production
- Aucune décision bloquante restante : D1, D2, D5, D6 actés ; D3/D4 abandonnés.
- Détails à confirmer en phase 00 : nom exact de la variable env D5 (proposé `REFRESH_TOKENS_DROP_GRACE_DAYS`), fichier logo retenu (`logo.png` racine).

## Preuves de clôture
- Rapports baseline et tests dans `plans/reports/` avec commandes et comptages réels.
- OpenAPI re-exporté sans diff (115/139 ; 30/33) ; hash des contrats frontends.
- Comptages tests réels (statique 14/08/2026 : 89 `*.spec.ts` sous `src/`, 15 `*.e2e-spec.ts`, 4 `*.integration-spec.ts` — écart avec AGENTS.md « 90/24 » à réconcilier en phase 00/06).
- Screenshots UI (login, account, console, portail, dark) + recherche « Keycloak » dans le DOM = 0.
- Manifest release avec SHA par dépôt, hash du realm, image tag, preuve du pré-vol D5 et du DROP.
