# Scout — Intégration Keycloak, interfaces et fichiers inutiles

## Périmètre

Lecture seule stricte (aucun fichier modifié, aucun test lancé) sur `D:\Projet-KAMGOKO\Test Backend Telecom`, le 2026-08-14. Objectif : cartographier l'intégration Keycloak, l'état des interfaces (frontend interne, portail public, thème Keycloak) et les fichiers morts/inutilisés, avant de planifier modernisation + nettoyage.

## Structure et stack (vérifié)

- [VÉRIFIÉ] Backend NestJS modulaire : 25 modules sous `src/modules/`, auth dans `src/modules/auth/`, identité publique dans `external-identity/`.
- [VÉRIFIÉ] Keycloak 26.7.1 : `keycloak-theme/Dockerfile:14` → `FROM quay.io/keycloak/keycloak:26.7.1`.
- [VÉRIFIÉ] Thème Keycloakify v11 : `keycloak-theme/package.json` → `keycloakify ^11.15.14`, React 18, Vite 6.
- [VÉRIFIÉ] Frontend interne : `frontend/` Next.js 16.2.11, React 19, Tailwind v4, shadcn/ui, Geist + Inter (`frontend/package.json`, `frontend/src/app/layout.tsx`).
- [VÉRIFIÉ] Portail public : `public-frontend/` Next.js 16.2.11, Geist, shadcn/ui, Tailwind v4.
- [VÉRIFIÉ] Contrat : `openapi.json` = 115 chemins / 139 opérations ; `openapi.public.json` = 30 chemins / 33 opérations (comptage `node` sur les fichiers réels).
- [SUPPOSÉ] 90 spec (585 tests) + 24 E2E selon `docs/implementation-status.md` — non ré-exécutés dans ce scout.

## Intégration Keycloak actuelle (vérifiée)

- [VÉRIFIÉ] SSO OIDC PKCE côté BFF : `frontend/src/lib/auth/keycloak.ts` (authorize, échange code, refresh, end-session, API admin), routes `frontend/src/app/api/auth/keycloak/{login,callback,logout,logout-all,account}/route.ts`.
- [VÉRIFIÉ] Validation backend RS256 via JWKS : `src/modules/auth/services/keycloak-jwks.service.ts`, stratégie `src/modules/auth/strategies/jwt.strategy.ts` (avec branche HS256 héritée).
- [VÉRIFIÉ] Provisionnement admin : `src/modules/auth/services/keycloak-admin.service.ts` (createUser, resetPassword, syncRealmRoles, setEnabled, ensureAccountRoles), appelé par `src/modules/users/users.service.ts:244-252,335,362,386`.
- [VÉRIFIÉ] Realm importé : `keycloak/import/telecom-realm.json` (7 rôles realm, client `telecom-frontend` public + PKCE S256, users seed).
- [VÉRIFIÉ] Thème : `keycloak-theme/src/pages/Login.tsx`, `Info.tsx`, `Error.tsx`, `account/Template.tsx` (Multi-Page), styles dans `keycloak-theme/src/styles.css`.
- [VÉRIFIÉ] Déconnexion toutes sessions via API admin : `frontend/src/lib/auth/keycloak.ts:154+` (revokeAllUserSessions) + route `logout-all`.

## Interfaces et mentions Keycloak (vérifié)

- [VÉRIFIÉ] `frontend/src/components/layout/user-menu.tsx:56-58` : libellé « Compte et mot de passe (Keycloak) ».
- [VÉRIFIÉ] `frontend/src/features/settings/account-panel.tsx:83,87-88` : « gérés par Keycloak » et bouton « Compte et mot de passe (Keycloak) » ; description confirm dialog mentionne Keycloak.
- [VÉRIFIÉ] `frontend/src/app/(auth)/login/page.tsx:14` : message « L'authentification est gérée par Keycloak » si `AUTH_PROVIDER !== keycloak` (fallback hérité).
- [VÉRIFIÉ] Thème login : marque « Telecom Ticket Management » + point bleu (pas de logo), footer « Portail incidents télécom — SSO sécurisé » ; console de compte : « Helpdesk Telecom » — nommage incohérent login/account.
- [VÉRIFIÉ] `frontend/src/app/globals.css` : thème `.dark` défini mais `frontend/src/features/settings/preferences.ts` retire toujours la classe `dark` et aucun toggle ne l'active → dark mode mort (soit à activer, soit à retirer).

## Fichiers morts / inutilisés (candidats, vérifiés)

- [VÉRIFIÉ] `src/common/services/token-cleanup.service.ts` + `.spec.ts` + table `refresh_tokens` (`src/database/schemas/refresh-tokens.ts`) : plus aucun écriture applicative ; seuls `TokenCleanupService` et `run-seed.ts:56` (delete) y touchent. `docs/jobs-and-workers.md:45` le déclare « hérité — inactif avec Keycloak SSO ».
- [VÉRIFIÉ] Branche HS256 + blacklist Redis dans `jwt.strategy.ts` : `validateKeycloak` (l.130-160) ne passe pas par `isRevoked` ; les clés `jwt_bl:*`, `jwt_user_bl:*` ne sont plus écrites nulle part (`rg` : uniquement la stratégie). Anciennes routes locales supprimées (CHANGELOG 2026-08-13).
- [VÉRIFIÉ] `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JWT_ACCESS_EXPIRATION`, `JWT_REFRESH_EXPIRATION` dans `.env.example:30-33` : `JWT_ACCESS_SECRET` reste utilisé comme sentinelle par `src/config/public-support.config.ts:60` (ne pas supprimer sans remplacement) ; `JWT_REFRESH_SECRET` et expirations semblent orphelins (à confirmer par recherche exhaustive avant suppression).
- [VÉRIFIÉ] `AUTH_PROVIDER` + `isKeycloakAuth()` : branche non-Keycloak du BFF (routes 404, page login de repli) — héritage de l'ancien auth local.
- [VÉRIFIÉ] Script `storybook` dans `keycloak-theme/package.json` sans dépendance Storybook installée (devDependencies sans `@storybook/*`).
- [VÉRIFIÉ] Docs obsolètes : `docs/database-schema.md:32` « keycloak_subject_id (en cours, migration 0019) » ; `docs/environment-variables.md:187` « SSO Keycloak (en cours) » ; `docs/jobs-and-workers.md:45` token cleanup « hérité ».
- [SUPPOSÉ] Autres candidats (à valider par usage avant suppression) : fichiers de test/artefacts `.next`, `playwright-report`, `test-results`, `coverage`, `dist`, `.pnpm-store`, `backups/` — hors Git ou régénérés, ne pas toucher sans vérification `git ls-files`.

## Patterns réutilisables (avec chemins)

- Client admin Keycloak centralisé : `src/modules/auth/services/keycloak-admin.service.ts` (étendre : groupes, attributs, événements).
- Cache JWKS : `keycloak-jwks.service.ts` (TTL 10 min, conversion x5c → PEM).
- Flux PKCE BFF complet : `frontend/src/lib/auth/keycloak.ts` + routes `api/auth/keycloak/*`.
- Design system frontend : composants `frontend/src/components/ui/*` (shadcn), tokens `globals.css`, préférences interface (`preferences.ts` : navigationTone, density, reduceMotion).
- Thème Keycloakify : `keycloak-theme/src/` (login + account Multi-Page, i18n fr/en).

## Risques et dépendances

- Supprimer `refresh_tokens` = migration destructive (table + seed + tests) : exiger vérification qu'aucun environnement ne l'écrit encore (anciennes versions déployées).
- Retirer la branche HS256 : vérifier `test/auth.e2e-spec.ts` et les tests de stratégie avant de casser des jetons applicatifs résiduels.
- `JWT_ACCESS_SECRET` : ne pas retirer avant d'avoir remplacé la sentinelle `public-support.config.ts`.
- Rebuild du thème Keycloak = rebuild de l'image `telecom-keycloak` (Dockerfile multi-stage) ; tester login + account + UpdatePassword + reset.
- « Sans mention de Keycloak » : les URL internes (`/api/auth/keycloak/*`) et noms de variables peuvent rester, seuls les textes visibles changent.

## Questions ouvertes

- Faut-il activer le dark mode (recommandé) ou le supprimer ?
- Nom de marque unique à afficher (KAMGOKO / Assistance Télécom / autre) ?
- La table `refresh_tokens` doit-elle être supprimée (migration) ou simplement désactivée ?
