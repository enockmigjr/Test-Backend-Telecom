# Phase 01 — Sécurité des jetons et authentification

## Statut

- Prévu — dépend de Phase 00
- Findings traités : **P1-1** (isRevoked contourné pour Keycloak), **P1-2** (email_verified fail-open), **P2-15** (WebSocket HS256-only), **P2-16** (blacklist fail-open par défaut), **P3-b** (secrets dev par défaut), **P3-d** (payload /auth/me), **P3-j** (X-Correlation-Id non borné)

## Contexte

La stratégie JWT est le point d'entrée de toute l'API. L'audit a montré que les jetons Keycloak (RS256, auth principale) contournent la vérification de révocation Redis, que `email_verified` est en fail-open, et que le WebSocket valide avec une clé HS256 différente de l'auth HTTP (JWKS). Trois sources de vérité différentes pour la validation de jeton.

## Vue d'ensemble

1. **P1-1** : déplacer l'appel `isRevoked(payload)` en tête de `validate()` pour qu'il s'applique aux jetons Keycloak ET internes (avant le branchement `isKeycloakToken`).
2. **P1-2** : `bindProfileByEmail` exige `payload['email_verified'] === true` (strict). Documenter le prérequis realm dans un commentaire + config.
3. **P2-15** : factoriser la validation de jeton dans un service commun (`TokenValidationService`) utilisé par `JwtStrategy` (HTTP, JWKS/HS256) et `WebSocketAuthService` (WS) — vérifier au préalable ce que le BFF place réellement dans le cookie (HS256 applicatif ou RS256 Keycloak) ; si le cookie porte un jeton Keycloak, le WS doit résoudre la clé JWKS comme l'HTTP.
4. **P2-16** : basculer la blacklist en fail-closed en production (`AUTH_REDIS_BLACKLIST_FAIL_OPEN` ne doit plus être `true` par défaut en prod) + alerte dédiée quand le repli fail-open est actif (log warn systématique).
5. **P3-b** : `JwtConfigService` lève une erreur au boot si `NODE_ENV` est absent (pas seulement si production).
6. **P3-d** : `GET /auth/me` retire `jti`/`sessionIssuedAt` du payload renvoyé (ou les documente si le frontend en dépend — vérifier `frontend/` avant).
7. **P3-j** : borner le header `X-Correlation-Id` (max 128 chars, charset `[A-Za-z0-9-_.]`), fallback sur génération.

## Exigences

- Contrat OpenAPI de `/auth/me` : si suppression de champs, mettre à jour `openapi.schemas` et vérifier le frontend ; sinon conserver.
- Zéro changement de comportement pour les jetons valides non révoqués.

## Étapes

1. Écrire le test de contrat qui échoue aujourd'hui : jeton Keycloak simulé avec `jti` blacklisté → doit être rejeté (401).
2. Refactorer `validate()` : `isRevoked` en tête, puis branchement par type.
3. Durcir `bindProfileByEmail` (strict `=== true`).
4. Créer `TokenValidationService` commun (mouvement de `secretOrKeyProvider` + `isRevoked` + `validateKeycloak`) ; brancher HTTP et WS dessus.
5. Config fail-closed prod + garde `NODE_ENV`.
6. Ajuster `/auth/me` et la middleware de corrélation.
7. Lancer les tests unitaires auth (specs existants + nouveaux) et E2E.
8. Mettre à jour `AGENTS.md` si le flux de révocation change de périmètre.

## Fichiers

- **Modifier** : `src/modules/auth/strategies/jwt.strategy.ts`, `src/modules/auth/auth.module.ts`, `src/modules/auth/auth.controller.ts`, `src/websocket/websocket-auth.service.ts`, `src/config/jwt.config.ts`, `src/common/middleware/correlation-id.middleware.ts`, specs associés
- **Créer** : `src/modules/auth/services/token-validation.service.ts` (+ spec), éventuellement DTO de réponse `/auth/me`

## Todo

- [ ] Test contrat : jeton Keycloak révoqué → 401 (échoue avant, passe après)
- [ ] Test : `email_verified` absent → pas de binding (échoue avant)
- [ ] WS et HTTP partagent la même validation (test d'intégration)
- [ ] Blacklist fail-closed en prod (test env)
- [ ] `NODE_ENV` requis au boot (test)
- [ ] `/auth/me` conforme (frontend vérifié)
- [ ] Correlation-Id borné (test)

## Critères de succès

- Gate B : la révocation s'applique aux jetons Keycloak ; `email_verified` strict.
- Tous les tests auth existants restent verts (aucun comportement légitime cassé).
- OpenAPI régénéré sans diff non intentionnel.
