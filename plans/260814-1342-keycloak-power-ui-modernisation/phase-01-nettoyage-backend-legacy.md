# Phase 01 — Nettoyage backend legacy (Keycloak-only)

## Statut
- Prévu — dépend de : validation phase 00 ; D2 acté (suppression après vérification des liens) ; D5 acté (fenêtre env).
- Références : `review-260814-1314` (P1-1, P2-15), plan `260814-1330` phase 01, inspection directe du dépôt le 14/08/2026.

## Contexte
Le code contient encore l'ancienne auth locale : branche HS256 dans `jwt.strategy.ts`, blacklist Redis orpheline (`jwt_bl:*`, `jwt_user_bl:*`, `jwt_blacklist`), `TokenCleanupService` + table `refresh_tokens` sans écriture applicative, env JWT locaux, fallback `AUTH_PROVIDER` côté BFF et compose. Danger : le WebSocket `/ws` vérifie le cookie via `JwtService.verifyAsync` (HS256) alors que le BFF y stocke le jeton Keycloak RS256 (P2-15) — migrer le WS **avant** de supprimer HS256. D2 exige une **vérification exhaustive des liens** avant toute suppression.

## Vue d'ensemble
1. Baseline chiffrée (build, tests, lint, OpenAPI) + **vérification exhaustive des liens** (`refresh_tokens`, HS256, `AUTH_PROVIDER`, env JWT).
2. Migration du WebSocket vers une vérification RS256 partagée.
3. Simplification de `jwt.strategy.ts` (RS256 seul + `isRevoked` pour tous).
4. Suppression du code `refresh_tokens` (après vérification) + migration gardée ; DROP final en phase 07.
5. Suppression des env JWT locaux, de la sentinelle `JWT_ACCESS_SECRET` et du fallback `AUTH_PROVIDER` (Keycloak-only).

## Exigences
- Aucun changement OpenAPI (Gate A).
- **Vérification exhaustive avant suppression** : `rg` sur backend, `frontend/`, `public-frontend/`, `keycloak/`, `docs/`, `test/`, migrations, `.github/`, docker-compose, `.env.example` pour `refreshTokens|refresh_tokens|JWT_REFRESH_*|AUTH_PROVIDER|HS256` ; chaque occurrence listée dans le rapport baseline avant modification.
- `isRevoked` appliqué aux jetons Keycloak avant toute suppression HS256 (P1-1) ; la révocation logout-all reste fonctionnelle (le BFF écrit `jwt_user_bl:{sub}` après la révocation admin Keycloak).
- DROP `refresh_tokens` uniquement via migration gardée + pré-vol `REFRESH_TOKENS_DROP_GRACE_DAYS` (D5).

## Architecture
- **Frontière** : auth = Keycloak seul ; plus aucun secret de signature applicatif JWT (hors jetons publics `external-identity` HS256 qui restent, non concernés).
- **Nouveau chemin WS** : cookie → décodage header → `KeycloakJwksService.publicKey(kid)` → `jwt.verify(token, clé, { algorithms: ['RS256'] })` → `JwtStrategy.validate(payload)` (non-révocation + profil métier). Extraction dans un service partagé pour éviter la duplication HTTP/WS.
- **Révocation** : `jwt_user_bl:{sub}` écrit par le BFF (`frontend/src/app/api/auth/keycloak/logout-all/route.ts`) après succès de `revokeAllUserSessions`, TTL = durée de vie access token + 5 min ; la clé `jwt_blacklist` (set legacy) est supprimée.
- **Migration 0020** : garde SQL (`DO $$ ... RAISE EXCEPTION ... $$`) qui refuse le DROP si une ligne de `refresh_tokens` a été écrite dans la fenêtre ; la fenêtre est pilotée par `REFRESH_TOKENS_DROP_GRACE_DAYS` (défaut 14) via un script de pré-vol `scripts/check-refresh-tokens-drop.mjs` ; exécution finale en phase 07 (Gate G).

## Étapes
1. Exécuter `pnpm run build`, `pnpm run test:unit`, `pnpm run test:e2e`, `pnpm run test:integration`, `pnpm run lint`, `pnpm run openapi:check` ; écrire `plans/reports/baseline-260814-{heure}-keycloak-power-ui-modernisation.md` avec les comptages réels (statique 14/08 : 89 spec, 15 e2e, 4 integration).
2. **Vérification exhaustive des liens** : lancer les `rg` ci-dessus sur tous les dépôts/docs/CI ; consigner chaque occurrence (fichier:ligne) dans le rapport baseline ; toute référence inattendue (ex. anciennes versions déployées, scripts hors dépôt) est signalée avant suppression.
3. Créer le service partagé de vérification RS256 ; migrer `websocket-auth.service.ts` ; mettre à jour `websocket-auth.service.spec.ts` avec une paire de clés RS256 générée dans le test ; supprimer l'usage de `JwtService` ; retirer `JwtModule` de `auth.module.ts` et `@nestjs/jwt` de `package.json` si plus référencé.
4. `jwt.strategy.ts` : allowlist `['RS256']`, suppression de la branche header HS256 et de l'injection `JwtConfigService` ; déplacer `isRevoked` avant le branchement Keycloak ; retirer le contrôle legacy `jwt_blacklist` ; conserver `jwt_bl`/`jwt_user_bl` (alimentés par le BFF). Mettre à jour `jwt.strategy.spec.ts` et `test/auth.e2e-spec.ts` (fixtures RS256, plus de `jwt.sign` HS256).
5. Après vérification (étape 2) : supprimer `token-cleanup.service.ts` + spec, `src/database/schemas/refresh-tokens.ts` + export dans `src/database/schemas/index.ts` + provider/export dans `common.module.ts` + `db.delete(schema.refreshTokens)` dans `run-seed.ts:56` ; adapter `test/integration/migrations.integration-spec.ts`.
6. Créer `src/database/migrations/0020_drop-refresh-tokens.sql` (garde + DROP, exécuté seulement en phase 07) et `scripts/check-refresh-tokens-drop.mjs` (lit `REFRESH_TOKENS_DROP_GRACE_DAYS`) ; lancer `pnpm run db:generate` ; tests migration sur base vide et base peuplée.
7. `public-support.config.ts` : remplacer la comparaison sentinelle `secret === process.env['JWT_ACCESS_SECRET']` par la seule règle `requiredSecret` 32+ ; adapter la spec ; supprimer `jwt.config.ts`, `jwt.config.spec.ts`, leurs exports `src/config/index.ts` et l'enregistrement `app-config.module.ts`.
8. Retirer `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JWT_ACCESS_EXPIRATION`, `JWT_REFRESH_EXPIRATION` et `AUTH_PROVIDER` de `.env.example`, `frontend/.env.example`, `docker-compose.yml` et `docker-compose.prod.yml` ; ajouter `REFRESH_TOKENS_DROP_GRACE_DAYS=14` à `.env.example`.
9. BFF : supprimer `isKeycloakAuth()` de `frontend/src/lib/auth/keycloak.ts`, les gardes 404 des 5 routes `api/auth/keycloak/{login,callback,logout,logout-all,account}`, le fallback de `frontend/src/app/(auth)/login/page.tsx` ; dans `logout-all/route.ts`, écrire `jwt_user_bl:{sub}` via ioredis (dépendance déjà présente) après révocation réussie.

## Fichiers
- **Modifier** : `src/modules/auth/strategies/jwt.strategy.ts`, `src/modules/auth/strategies/jwt.strategy.spec.ts`, `src/websocket/websocket-auth.service.ts`, `src/websocket/websocket-auth.service.spec.ts`, `src/modules/auth/auth.module.ts`, `src/config/app-config.module.ts`, `src/config/index.ts`, `src/config/public-support.config.ts`, `src/config/public-support.config.spec.ts`, `src/common/common.module.ts`, `src/database/schemas/index.ts`, `src/database/seed/run-seed.ts`, `test/auth.e2e-spec.ts`, `test/integration/migrations.integration-spec.ts`, `.env.example`, `frontend/.env.example`, `docker-compose.yml`, `docker-compose.prod.yml`, `package.json` (retrait `@nestjs/jwt` si orphelin), `frontend/src/lib/auth/keycloak.ts`, `frontend/src/app/api/auth/keycloak/{login,callback,logout,logout-all,account}/route.ts`, `frontend/src/app/(auth)/login/page.tsx`.
- **Créer** : `src/modules/auth/services/keycloak-token-verifier.service.ts` (+ spec), `src/database/migrations/0020_drop-refresh-tokens.sql`, `scripts/check-refresh-tokens-drop.mjs`, `plans/reports/baseline-260814-{heure}-keycloak-power-ui-modernisation.md`.
- **Supprimer** : `src/common/services/token-cleanup.service.ts`, `src/common/services/token-cleanup.service.spec.ts`, `src/database/schemas/refresh-tokens.ts`, `src/config/jwt.config.ts`, `src/config/jwt.config.spec.ts`.

## Todo et tests
- [ ] Baseline exécutée et rapportée (comptages réels, écarts AGENTS.md documentés)
- [ ] Vérification exhaustive des liens consignée (fichier:ligne) avant toute suppression
- [ ] WS authentifié avec jeton RS256 (test unitaire + vérification runtime phase 06)
- [ ] `isRevoked` appliqué aux jetons Keycloak (test : jeton Keycloak + `jwt_user_bl` → 401)
- [ ] BFF écrit `jwt_user_bl` après logout-all (test de route)
- [ ] Zéro référence `HS256`/`AUTH_PROVIDER`/`JwtConfigService`/`JWT_REFRESH_*` dans le dépôt (rg sur tous les dépôts/docs)
- [ ] `refresh_tokens` absente du code (rg) ; migration 0020 présente avec garde ; script pré-vol lit `REFRESH_TOKENS_DROP_GRACE_DAYS`
- [ ] `openapi:check` vert (115/139 ; 30/33)
- [ ] `pnpm run build` + `test:unit` verts ; fichiers modifiés < 200 lignes

## Critères de succès
- Gate B atteinte : WS fonctionne en runtime avec un vrai jeton Keycloak, plus aucun chemin HS256 dans le backend, Keycloak-only partout.
- La table `refresh_tokens` n'est plus référencée par le code ; sa suppression physique reste conditionnée à D5 (env) + phase 07.
- Le contrat OpenAPI n'a pas changé.
