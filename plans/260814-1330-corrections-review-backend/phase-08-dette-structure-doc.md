# Phase 08 — Dette de structure et alignement doc/code

## Statut
- Prévu — dernière phase (peut démarrer en continu après Phase 02)
- Findings traités : **P3-ag** (22 fichiers > 200 lignes), **P3-o** (pagination triple + publicStatusEventType), **P3-q** (N+1 notification — voir aussi P2-45), **P3-ai** (drift OpenAPI/TS ApiResponse), **P3-f** (redactSignature incomplet), **P3-e** (PII — traité en Phase 02 pour users), **P3-t** (loggers morts), **P3-u** (types de notification incohérents), **P3-w** (parseInt('0') || 8), **P3-s** (SettingsModule re-déclare DrizzleProvider), **P3-r** (KeycloakAdminService token non caché), **P3-ak** (RedisConfigService mort + catch silencieux + getters), **P3-al** (coverage users — traité Phase 02), **P3-am** (details GlobalExceptionFilter — défensif), **P3-ae/ad** (extraits/LIKE — traités Phase 06), **P2-45** (N+1 notifications)

## Contexte
La dette restante est surtout structurelle : 22 fichiers dépassent la règle des 200 lignes (dont `run-seed.ts` à 1141), trois mécanismes de pagination coexistent, la config Redis est dupliquée (une classe morte), l'interface `ApiResponse` TS diverge de l'OpenAPI, et certains détails qualité (types de notification, loggers morts, `||` vs `??`) subsistent.

## Vue d'ensemble
1. **P3-ag** : découper en priorité les fichiers les plus critiques — `tickets.service.ts` (683 l. → `ticket-lifecycle.service.ts`, `ticket-sla.service.ts` déjà prévu Phase 03, `ticket-query.service.ts`), `dashboard.service.ts` (730 l. → un service par rapport), `users.service.ts` (483 l. → `user-query.service.ts`, `user-provisioning.service.ts`), `run-seed.ts` (1141 l. → modules de données par domaine) ; les autres suivent au fil des phases précédentes. Activer `max-lines: 200` en `error` en fin de phase.
2. **P3-o** : unifier la pagination (un seul helper canonique + DTO partagé) ; centraliser `publicStatusEventType` dans `src/modules/tickets/domain/public-ticket-status.ts`.
3. **P2-45** : batch `inArray(users.id, recipientIds)` + pré-chargement du contexte ticket dans le listener de notifications.
4. **P3-ai** : aligner `ApiResponse` TS sur l'OpenAPI (ajouter `statusCode`) ; dans `TransformInterceptor`, ne court-circuiter que les enveloppes valides.
5. **P3-am** : borner `details` dans `GlobalExceptionFilter` (structures connues ; filtrer stack traces en production).
6. **P3-f** : étendre `redactSignature` aux paramètres sensibles (`token`, `code`, `otp`, `signature`).
7. **P3-t/u/w/x** : supprimer les loggers morts ; corriger `TICKET_RESOLVED`→`TICKET_CLOSED` et `COMMENT_ADDED`→`TICKET_REOPENED` (vérifier le frontend qui consomme ces types) ; `Number.isFinite` au lieu de `||` pour les settings ; `??` au lieu de `||` pour nextval.
8. **P3-s** : retirer la re-déclaration de `DrizzleProvider` dans SettingsModule (vérifier au runtime l'absence de second pool).
9. **P3-r** : cacher le token admin Keycloak (TTL court, ~50-60 s).
10. **P3-ak** : supprimer `src/config/redis.config.ts` (classe morte) ; logger les échecs de parsing ; figer les valeurs de config au bootstrap (provider `useFactory`).
11. **AGENTS.md** : mettre à jour les écarts actés (cache dashboard, RBAC si D1, retries) — uniquement ce qui est confirmé par le code.

## Exigences
- Aucun changement de comportement : refactors purement structurels validés par les tests existants.
- Les types de notification : vérifier la consommation frontend (`frontend/`) avant renommage.

## Étapes
1. Unifier la pagination (tests existants comme filet).
2. Refactorer les 4 fichiers prioritaires + activation `max-lines` en error.
3. Batch notifications + tests.
4. Alignements OpenAPI/TS + details filtre + redaction.
5. Nettoyages qualité (loggers, types, settings, nextval, DrizzleProvider, token admin, RedisConfig).
6. Mise à jour AGENTS.md (écarts actés).
7. Suite complète : unit + E2E + intégration + lint + openapi:check.

## Fichiers
- **Modifier** : nombreux (voir findings) — par lots, un commit/PR par domaine si possible
- **Créer** : services extraits (`ticket-lifecycle.service.ts`, `dashboard-overview.service.ts`, `user-query.service.ts`, `seed/` modules par domaine)

## Todo
- [ ] Pagination unifiée (P3-o)
- [ ] publicStatusEventType centralisée (P3-o)
- [ ] Batch notifications (P2-45)
- [ ] 22 fichiers ≤ 200 lignes, max-lines en error (P3-ag)
- [ ] ApiResponse alignée (P3-ai)
- [ ] details filtre bornés (P3-am)
- [ ] redaction étendue (P3-f)
- [ ] Nettoyages qualité (P3-t/u/w/x/s/r/ak)
- [ ] AGENTS.md mis à jour sur les écarts actés
- [ ] Suite complète verte (Gate F)

## Critères de succès
- Gate F : `pnpm run test:all` vert, `pnpm run lint` sans erreur, `pnpm run openapi:check` vert.
- `max-lines: 200` en `error` actif sans exception (sauf justification écrite pour le seed).
- Aucun fichier de production > 200 lignes.
