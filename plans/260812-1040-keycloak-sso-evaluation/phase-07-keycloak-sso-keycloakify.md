# Phase 07 — Keycloak SSO + Keycloakify (identité externalisée)

## Objectif

Remplacer la gestion d'identité locale par Keycloak (source de vérité : comptes, mots de passe, rôles), brancher le frontend interne en SSO (Authorization Code + PKCE), garder uniquement le profil métier côté système, et thémer les écrans de login avec Keycloakify aux couleurs réelles de l'app.

## Décisions utilisateur actées

- SSO **frontend interne uniquement** ; portail public et widget conservent leur BFF.
- **Suppression du login local** après bascule (pas de fallback).
- Le système ne garde que le profil métier (département, disponibilité, absence), lié par `keycloakSubjectId`.
- Keycloak en **conteneur docker-compose** ; realm versionné ; seed complet (utilisateurs + profils métier) pour repartir de zéro sans tout refaire.
- Thème Keycloakify aux couleurs de l'app — couleur à confirmer (proposition : bleu nuit `#172033` + bleu `#1d4ed8`).

## Architecture cible

```
Navigateur → frontend Next.js (BFF) → /api/auth/keycloak (code + PKCE) → Keycloak (login thématisé Keycloakify)
                  │
                  └── session cookie signée (JWT) → API NestJS
                          │
                          └── JwtStrategy (JWKS Keycloak) → payload.sub → users.keycloakSubjectId → profil métier
```

## Workflow

1. **Conteneur Keycloak** : service compose (`quay.io/keycloak/keycloak:26.x`, ports, `KEYCLOAK_ADMIN`/`KEYCLOAK_ADMIN_PASSWORD` via env), import realm au premier démarrage (`--import-realm` + `/opt/keycloak/data/import/realm-export.json`). Détails de version/commande à re-vérifier à l'implémentation (recherche web indisponible à la rédaction).
2. **Realm seed** : `realm-export.json` versionné — client `telecom-frontend` (confidential/public + PKCE, redirect URIs), client service-account si besoin, rôles (7 rôles métier), utilisateurs de démo, mappers (roles → claim `realm_access`), thème de login `keycloakify`.
3. **Seed métier** : étendre `run-seed.ts` pour créer les profils (départements, users avec `keycloakSubjectId` correspondant, isAvailable, absenceEndsAt) ; suppression des comptes locaux dans le seed.
4. **Backend** : adapter `JwtStrategy` pour valider les jetons Keycloak (issuer + JWKS), mapper `sub → keycloakSubjectId`, extraire le rôle depuis `realm_access.roles` (ou mapper personnalisé), conserver `JwtPayload` (sub=keycloakSubjectId). Supprimer les routes login/refresh locales (ou les garder hors prod selon validation) ; les garder masquées pendant la transition.
5. **Frontend** : remplacer le formulaire de login par une redirection vers `/api/auth/keycloak` (start) ; gestion callback, logout Keycloak (end_session_endpoint), refresh via session BFF (rotation conservée côté système sur l'identité de session).
6. **Keycloakify** : nouveau projet `frontend-keycloak-theme/` (Vite + Keycloakify), copie des tokens CSS (primary oklch(0.218 0.008 223.9), #1d4ed8, #0f766e, #b42318, Inter), build → JAR injecté dans l'image Keycloak (ou upload Admin Console), tests visuels des écrans (login, error, idle timeout, MFA éventuel).
7. **Transition** : bascule feature-flag (`AUTH_PROVIDER=keycloak`) ; gate : parcours complet validé avant suppression du login local ; les comptes existants sont remplacés par le seed.

## Fichiers

- `docker-compose.yml` (service keycloak), `keycloak/realm-export.json`, `keycloak/Dockerfile` (thème)
- `frontend-keycloak-theme/` (nouveau dépôt ou dossier dédié)
- `src/config/*` (KEYCLOAK_ISSUER, KEYCLOAK_JWKS), `src/modules/auth/strategies/*`, `auth.controller.ts`
- `src/database/seed/run-seed.ts`, `src/database/schemas/users.ts` (keycloakSubjectId)
- `frontend/src/app/login/page.tsx` (redirection), `frontend/src/lib/auth/*`, middleware/proxy
- `Makefile` (cibles keycloak)

## Risques

- Version Keycloak / syntaxe d'import et de thème : **à re-vérifier par recherche web** au début de la phase.
- Casser la session BFF existante : garder le même format de session, ne changer que le mode de preuve d'identité.
- `sub` Keycloak ≠ ancien `users.id` : le seed doit fournir le mapping avant la bascule.
- Logout SSO vs logout local : `end_session_endpoint` avec id_token_hint.

## Critères de validation

- Login SSO complet (redirection → Keycloak thématisé → retour → session BFF) sur navigateur.
- Rôles mappés correctement (admin/superviseur/agents) ; accès RBAC inchangés.
- Profil métier résolu pour chaque utilisateur seed ; 403/404 clair sinon.
- Logout termine la session Keycloak ET la session BFF.
- Plus aucune route de login local accessible en production.
- Thème Keycloakify rendu avec les couleurs de l'app (captures comparées).

## Tests

- Unitaires : stratégie JWT (jetons signés/non signés, issuer, rôles), mapping sub.
- E2E : parcours login/logout SSO, accès RBAC, session expirée → retour Keycloak.
- Contrat OpenAPI : compte d'opérations ajusté si routes locales retirées.
