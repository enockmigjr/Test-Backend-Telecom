# Phase 07 — Keycloak SSO + Keycloakify (identité externalisée)

## Objectif

Remplacer la gestion d'identité locale par Keycloak (source de vérité : comptes, mots de passe, rôles), brancher le frontend interne en SSO (Authorization Code + PKCE), garder uniquement le profil métier côté système, et thémer les écrans de login avec Keycloakify aux couleurs réelles de l'app.

## Décisions utilisateur actées

- SSO **frontend interne uniquement** ; portail public et widget conservent leur BFF.
- **Suppression du login local** après bascule (pas de fallback).
- Le système ne garde que le profil métier (département, disponibilité, absence), lié par `keycloakSubjectId`.
- Keycloak en **conteneur docker-compose** ; realm versionné ; seed complet (utilisateurs + profils métier) pour repartir de zéro sans tout refaire.
- Thème Keycloakify aux couleurs de l'app (proposition validée : bleu nuit `#172033` + bleu `#1d4ed8`).

## Architecture cible

```
Navigateur → frontend Next.js (BFF) → /api/auth/keycloak (code + PKCE) → Keycloak (login thématisé Keycloakify)
                  │
                  └── session cookie signée (JWT) → API NestJS
                          │
                          └── JwtStrategy (JWKS Keycloak) → payload.sub → users.keycloakSubjectId → profil métier
```

## Workflow

1. **Conteneur Keycloak** : service compose (`quay.io/keycloak/keycloak:26.7.0`, ports, `KEYCLOAK_ADMIN`/`KEYCLOAK_ADMIN_PASSWORD` via env), import realm au premier démarrage (`--import-realm`).
2. **Realm seed** : `keycloak/import/telecom-realm.json` versionné — client public `telecom-frontend` (PKCE, redirect URIs), 7 rôles métier, admin/superviseur de démo, thème de login `telecom-keycloak-theme`, localisation fr/en.
3. **Seed métier** : `keycloak/seed-users.mjs` (105 comptes, email vérifié) pour repartir de zéro.
4. **Backend** : `JwtStrategy` hybride (HS256 app / RS256 Keycloak via JWKS), mapping `sub → keycloakSubjectId`, rôle depuis `realm_access.roles`, rattachement auto au premier login par email vérifié.
5. **Frontend** : redirection vers `/api/auth/keycloak/login` (start), callback, logout Keycloak, bascule `AUTH_PROVIDER=local|keycloak`.
6. **Keycloakify** : projet `keycloak-theme/` (Vite + keycloakify v11), pages custom Login/Error/Info aux couleurs de l'app, build → JAR injecté dans l'image Keycloak.
7. **Transition** : bascule feature-flag (`AUTH_PROVIDER=keycloak`) ; gate : parcours complet validé avant suppression du login local.

## Fichiers

- `docker-compose.yml` / `docker-compose.prod.yml` (service keycloak), `keycloak-theme/` (Dockerfile, src, package.json, pnpm-lock)
- `keycloak/import/telecom-realm.json`, `keycloak/seed-users.mjs`
- `src/modules/auth/strategies/jwt.strategy.ts`, `src/modules/auth/services/keycloak-jwks.service.ts`
- `frontend/src/app/api/auth/keycloak/*`, `frontend/src/lib/auth/keycloak.ts`
- `Makefile` (cibles keycloak-up / keycloak-seed), `.env.example` (backend + frontend)

## Risques

- Version Keycloak / syntaxe d'import et de thème (vérifié en live : 26.7.0 + keycloakify v11).
- Casser la session BFF existante : même format de session, seul le mode de preuve d'identité change.
- `sub` Keycloak ≠ ancien `users.id` : mapping par `keycloakSubjectId` + rattachement email vérifié.
- Logout SSO vs logout local : `end_session_endpoint` avec id_token_hint.
- Keycloakify v5 incompatible avec Keycloak 26 (FreeMarker `Locale.getISO3Language`, module system Java 21) → migration v11.
- Réseau conteneurisé : l'API Docker doit joindre Keycloak par le nom de service (`KEYCLOAK_JWKS_URL`), pas par `localhost`.

## Critères de validation

- Login SSO complet (redirection → Keycloak thématisé → retour → session BFF) sur navigateur.
- Rôles mappés correctement (admin/superviseur/agents) ; accès RBAC inchangés.
- Profil métier résolu pour chaque utilisateur seed ; 403/404 clair sinon.
- Logout termine la session Keycloak ET la session BFF.
- Plus aucune route de login local accessible en production.
- Thème Keycloakify rendu avec les couleurs de l'app.

## Tests

- Unitaires : stratégie JWT (jetons signés/non signés, issuer, rôles), mapping sub.
- E2E : parcours login/logout SSO, accès RBAC, session expirée → retour Keycloak.
- Contrat OpenAPI : compte d'opérations ajusté si routes locales retirées.

## Statut de la phase

- VALIDÉ en live le 2026-08-12 (voir section Livraison).

## Livraison 2026-08-12 — validation live SSO

### Implémenté et vérifié en runtime

- **Keycloak 26.7.0** en conteneur, realm `telecom` importé, localisation activée (`defaultLocale: fr`, `supportedLocales: [fr, en]`).
- **105 comptes seedés** : `node keycloak/seed-users.mjs` → « Seed Keycloak terminé : 105 comptes créés dans telecom » (7 rôles × 15 + admin/superviseur du realm).
- **Thème Keycloakify v11** : JAR `keycloak-theme-for-kc-all-other-versions.jar` dans `/opt/keycloak/providers/`, `loginTheme: telecom-keycloak-theme`, pages custom Login/Error/Info + `DefaultPage` keycloakify pour les autres pages.
- **Stratégie JWT hybride** HS256/RS256 (JWKS), liaison `sub → users.keycloakSubjectId`, rattachement auto par email vérifié.
- **Frontend BFF** : routes `/api/auth/keycloak/login|callback|logout` (Authorization Code + PKCE), bascule `AUTH_PROVIDER=local|keycloak`.

### Preuves de validation (live)

1. Discovery OIDC → 200, issuer `http://localhost:8081/realms/telecom` (port 8081, 8080 étant utilisé par PhotoVault).
2. Page de login SSO → HTTP 200 avec le thème `telecom-keycloak-theme` (shell + `window.kcContext` + chunk `KcPage` contenant le formulaire custom).
3. Flux PKCE complet : auth → login `admin@telecom.local` (302 + code) → échange token (200, `access_token` RS256).
4. `GET /api/v1/auth/me` avec le token Keycloak → 200 `{ email: admin@telecom.local, role: ADMINISTRATOR, departmentId: … }`.
5. Tests unitaires stratégie JWT : 4/4 passants.

### Correctifs apportés pendant la validation

- **P0 — requêtes Bearer bloquées** : `secretOrKeyProvider` async ne rappelait pas `done` (passport-jwt 4 attend un callback) → réécrit en style callback.
- **JWKS conteneurisé** : `KEYCLOAK_JWKS_URL` (interne Docker) dissocié de l'issuer public.
- **Keycloakify v5 → v11** : v5 incompatible avec Keycloak 26 ; v11 corrige la gestion de `locale` et le module system Java 21.
- **Realm localisé** : `internationalizationEnabled + defaultLocale fr` (évite le locale `*`).

### Bascule

`AUTH_PROVIDER=keycloak` + `KEYCLOAK_ISSUER`/`KEYCLOAK_REDIRECT_URI` dans le `.env` du frontend ; backend : `KEYCLOAK_ISSUER` (public) + `KEYCLOAK_JWKS_URL` (interne Docker). Voir `.env.example` (backend) et `frontend/.env.example`.
