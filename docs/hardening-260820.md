# Hardening backend — 20 août 2026 (branche `fix/backend-hardening-260820`)

> Synthèse des correctifs appliqués suite aux audits `review-260814-1314` (12 P1) + `review-260814-1600` (3 CRITICAL) + `audit-260820-1723` (réconcilié). Tous les changements sont sur la branche `fix/backend-hardening-260820` (`d214c5e`), `main` reste à `3d0b1d0`.

## Contexte

- **Périmètre** : `src/` backend NestJS (25 modules, 8 queues, 2 namespaces WS, 31 tables, 139 opérations OpenAPI).
- **Verdict 14/08** : 0 P0, 12 P1, ~41 P2, ~46 P3 — architecture solide (outbox, crypto AES-GCM, cloisonnement tenant) mais 4 familles à risque : auth/révocation, atomicité tickets, fiabilité files/états terminaux, surfaces admin/secrets.
- **Objectif 20/08** : fermer les 12 P1 + P2 critiques, documenter, garder `89 suites / 584 tests` verts.

## P0 — Secrets

| Fichier | Avant | Après | Impact |
|---|---|---|---|
| `.env.example:236` | `PUBLIC_SUPPORT_BOT_API_KEY=sk-215d…` réelle | `REPLACE_ME` + commentaire | Purge clé facturable, rotation conseillée |

## P1 — Sécurité

1. **JWT `email_verified` fail-open** `src/modules/auth/strategies/jwt.strategy.ts:101` : `!== false` → `=== true` strict. Sans `email_verified:true`, pas de `bindProfileByEmail`.
2. **Blacklist fail-open** `jwt.strategy.ts:163` : `AUTH_REDIS_BLACKLIST_FAIL_OPEN` → `false` en prod (fail-closed), `true` en dev (log warn). Timeout Redis 1s conservé.
3. **RBAC cible** `src/modules/users/users.service.ts:299-312` : SUPERVISOR bloque si `userToUpdate.role ∈ {ADMIN,SUPERVISOR}` (avant : seul `dto.role` vérifié). `users.controller.ts:126` `findOne/:id` filtre par département (404 hors périmètre). `deactivate` bloque self-disable + dernier ADMIN (`count(*) WHERE role=ADMIN AND isActive`).
4. **Email poison** `users.service.ts:259` : échec Keycloak `update deletedAt` → `delete` physique (email recréable). Schéma `src/database/schemas/users.ts:32,69,72` : `idx_users_email WHERE deleted_at IS NULL` + `idx_users_keycloak_subject WHERE NOT NULL` (migration `0023_hardening_indexes_partial.sql`).
5. **State machine tickets** `ticket-permissions.ts:81,136` : `assign` refuse `CLOSED/CANCELLED/RESOLVED`, `escalate` refuse `CLOSED/CANCELLED` + `NEW` doit d'abord être `ASSIGNED`.
6. **BullBoard** `src/common/bull-board/bull-board.module.ts:22-45` : `timingSafeEqual`, gating prod (500 si `BULLBOARD_USER/PASSWORD` absents), basePath `${API_PREFIX}/admin/queues`.
7. **`/metrics`** `src/common/metrics/metrics.controller.ts:13-22` : `METRICS_SCRAPE_TOKEN` Bearer optionnel (`timingSafeEqual`), sinon public (dev).
8. **Liens rapports** `src/modules/reports/report-download-link.service.ts:16,78` : gating même hors prod + `TTL 604800→172800` (2j).

## P1 — Fiabilité

9. **Atomicité tickets** `src/modules/tickets/services/tickets.service.ts:242-467` : `assign/escalate/update` en `runInTransaction` + `WHERE status=old` (ConflictException si race). `update` recalcule SLA si `priority/category` change (lookup `slaPolicies`). `buildSlaUpdateFields` cumule `accumulatedPauseMs` même vers `RESOLVED`, réouverture `calendarType 24_7/BO` + `TICKET_REOPEN_SLA_MINUTES`.
10. **SLA pause-aware** `sla-alert-processor.service.ts:108-171` : `FIRST_RESPONSE` filtre `slaPausedAt IS NULL` + relance 6h ignore tickets en pause.
11. **Queues** `src/queues/queues.module.ts:56-79` : `email/notification/sla/audit/assignment` → `attempts 3-5, backoff exponential, removeOnComplete 3600`.
12. **ReportWorker** `src/queues/workers/report.worker.ts:55-352` : `isFinalAttempt = attemptsMade+1>=maxAttempts` — `failed` seulement au dernier essai, `throw` sinon.
13. **Livraisons** `src/modules/external-delivery/services/external-delivery.service.ts:44-84` : `DELIVERY_UNKNOWN` rejeu après 30 min + `POST /external-deliveries/:id/retry` (admin) + `jobId retry-…` dédup.

## P2 — Cohérence & perf

- **Dashboard** `src/modules/dashboard/dashboard.service.ts:16,124,154` : `atRisk` exclusif (`gt now`), `totalTracked/complianceRate` sur `openTotal`.
- **Idempotence** `src/common/interceptors/idempotency.interceptor.ts:89` : `DELETE` hot path supprimé — purge via `retention-cleanup.service.ts:81-89` (30j + `PENDING expirés`).
- **Rétention** `retention-cleanup.service.ts:81` : `inArray([EXPIRED,LOCKED,PENDING]) WHERE expiresAt < cutoff`.
- **Satisfaction** `support-satisfaction.service.ts:67` : `AND consumedAt IS NULL RETURNING` atomique.
- **Bot** `support-bot.service.ts:51,105` : boucle outils multi-tours + `consumeBudget` + `ToolPolicyService.authorize(status réel)`.
- **Global filter** `global-exception.filter.ts:49` : `details` borné (pas de stack), arrays validation conservés.
- **Headers** `correlation-id.middleware.ts:33` borné `^[A-Za-z0-9._-]{1,64}$`, `request-logger` redact étendu, `attachments.controller.ts:151` `Cache-Control: private, no-store`, `departments.service.ts:117` 409 si nom dupliqué, `redis-io.adapter.ts:36` retryStrategy + handler `error`.

## Schéma & migrations

- `0023_hardening_indexes_partial.sql` + `_journal.json:23` (additif, pas de rollback destructif).
- `DATABASE_MAX_CONNECTIONS` non changé (500 reste, mais documenté).

## Docs mises à jour

- `README.md` : hardening, BullBoard `timingSafeEqual`, reports 2j, delivery `POST retry`, rate limiting repli, `584 tests`.
- `docs/security.md` : `email_verified strict`, `isRevoked` prod, `findOne` filtré, `X-Correlation-Id` borné, `METRICS_SCRAPE_TOKEN`, `BULLBOARD` prod.
- `docs/environment-variables.md` : `METRICS_SCRAPE_TOKEN`, `TICKET_REOPEN_SLA_MINUTES`, `AUTH_REDIS_BLACKLIST_FAIL_OPEN`, `REPLACE_ME`.
- `docs/routes.md` : `POST /external-deliveries/{id}/retry` + `/metrics` tokenisé.
- `CHANGELOG.md` : entrée `2026-08-20` complète.

## Tests

- `89 suites / 584 passés` (après ajustement de 6 specs : `users`, `external-delivery`, `global-exception`, `dashboard`, `departments`, `idempotency`).
- `pnpm run build` + `lint --max-warnings=0` verts.

## Reste (Phase 08 dette)

- `pg_trgm` trigram `ILIKE`, cache dashboard 60s, split fichiers >200l, pagination helper unique, N+1 `ticket-notification.listener`, `audit-logs` DTO — à traiter au fil de l'eau (non bloquant P0/P1).

## Commandes de vérif

```bash
git checkout fix/backend-hardening-260820
pnpm run build && pnpm run lint && pnpm run test
# migrations
pnpm run db:push   # applique 0023
pnpm run db:phase9-check
```
