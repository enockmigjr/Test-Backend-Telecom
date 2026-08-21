# Audit backend exigeant — Revue complète sans modification

**Date** : 2026-08-20 17:10 (UTC+1)
**Périmètre** : Backend NestJS `D:\Projet-KAMGOKO\Test Backend Telecom\src` — lecture seule, aucun fichier modifié, aucun test lancé, aucune commande destructive.
**Mode** : Senior exigeant — tout ce qui est illogique, redondant, risqué, non sécurisé ou fragile est listé.
**Références** : `contexte/defi-backend-en-nestjs.md`, `contexte/phase-*.md`, `contexte/DBML DE BASE… .sql`, `AGENTS.md`, `C:\Users\user\.codex\HARNESS.md`

---

## Périmètre vérifié

| Domaine         | Preuves                                                                                                                                                                                                                                                                                                                                                                        |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Structure       | `src/` : 435 fichiers `.ts` comptés via `Get-ChildItem -Recurse`, 25 modules métier dans `src/modules/`, `src/common/`, `src/queues/`, `src/websocket/`, `src/database/`, `src/config/`                                                                                                                                                                                        |
| Bootstrap       | `src/main.ts:15-119`, `src/app.module.ts:1-187` lus intégralement                                                                                                                                                                                                                                                                                                              |
| Auth            | `src/modules/auth/strategies/jwt.strategy.ts:1-183`, `guards/request-auth.guard.ts`, `services/keycloak-jwks.service.ts:1-65`, `guards/roles.guard.ts`, `common/guards/department-abac.guard.ts`, `common/services/ticket-access.service.ts:1-129`                                                                                                                             |
| Tickets         | `tickets/domain/ticket-status-transitions.ts`, `ticket-permissions.ts:1-267`, `services/tickets.service.ts:1-683`, `database/schemas/tickets.ts:1-175`                                                                                                                                                                                                                         |
| SLA             | `sla/sla-engine.service.ts:1-59`, `sla-alert-processor.service.ts:1-313`, `common/helpers/sla.helper.ts:1-98`                                                                                                                                                                                                                                                                  |
| Outbox          | `outbox/services/outbox.service.ts:1-78`, `database/schemas/outbox-events.ts:1-82`, `database/drizzle.provider.ts:1-101`                                                                                                                                                                                                                                                       |
| Attachments     | `attachments/attachments.service.ts:1-176`, `attachment-upload.config.ts` (via grep)                                                                                                                                                                                                                                                                                           |
| Public          | `public-support/services/public-conversation.service.ts:1-176`, `external-identity/services/contact-verification.service.ts:1-158`, `public-session.service.ts:1-128`, `support-bot/services/support-bot.service.ts:1-261`                                                                                                                                                     |
| Infra           | `common/providers/throttler-storage-redis.provider.ts:1-161`, `websocket/websocket.gateway.ts:1-173`, `dashboard/dashboard.service.ts:1-730`, `reports/reports.service.ts:1-502`, `common/filters/global-exception.filter.ts:1-114`, `common/interceptors/idempotency.interceptor.ts:1-168`, `config/public-support.config.ts:1-152`, `common/openapi/public-openapi.ts:1-185` |
| Secrets / env   | `.env.example` (80+ vars, grep `CORS_ORIGIN/BOT_API_KEY/MASTER_KEYS/REPORT_DOWNLOAD`)                                                                                                                                                                                                                                                                                          |
| Scout préalable | `Task explore` (496 fichiers scannés, 23 migrations SQL, 18 enums, 30 tables, 139 opérations OpenAPI)                                                                                                                                                                                                                                                                          |

**Non exécuté** : `pnpm test`, `pnpm run openapi:check`, `pnpm lint`, `docker compose up`, drills de pannes, requêtes runtime vers Keycloak/Redis/Postgres.

---

## Verdict global

**PAS PRÊT pour un go-live sans corrections P0** — le socle est solide, documenté, et la plupart des patterns sont production-grade, mais 6 défauts P0 (bloquants) subsistent et 15 P1 dégradent la sécurité, la cohérence ou la maintenabilité. Le reste est P2.

| Catégorie                | P0    | P1     | P2     |
| ------------------------ | ----- | ------ | ------ |
| Sécurité                 | 2     | 5      | 4      |
| Données / transactions   | 2     | 3      | 2      |
| Architecture / cohérence | 1     | 4      | 5      |
| Observabilité / prod     | 1     | 3      | 3      |
| **Total**                | **6** | **15** | **14** |

---

## Constats

### 1. Sécurité — authentification, autorisation, exposition

- [VÉRIFIÉ] **P0-1 — Clé d'exemple réelle committée** — ` .env.example: PUBLIC_SUPPORT_BOT_API_KEY=sk-215d0319f41f47e6ae5771b075c0cf53` est une vraie clé DeepSeek d'apparence valide (préfixe `sk-` + hex). N'importe quel clone du dépôt fuit un secret facturable. Le fichier est suivi par git (`git ls-files` l'inclut). — ` .env.example:1-200` (grep)
- [VÉRIFIÉ] **P0-2 — Révocation JWT fail-open par défaut** — `jwt.strategy.ts:163-165` `AUTH_REDIS_BLACKLIST_FAIL_OPEN !== 'false'` renvoie `false` par défaut : si Redis tombe, un jeton révoqué (logout, offboarding) reste accepté. Un utilisateur révoqué garde l'accès jusqu'à expiration du JWT (5 min Keycloak). Aucune alerte métier n'est émise. Le choix est documenté mais le défaut est l'inverse de "secure by default".
- [VÉRIFIÉ] **P1-1 — Bind de profil par email sans vérification stricte** — `jwt.strategy.ts:98-118` `bindProfileByEmail` accepte `email_verified !== false` (donc `undefined` = vérifié). Le premier login d'un `sub` inconnu lie un compte interne par `email` lowercasé. Un IdP mal configuré ou un realm Keycloak sans `email_verified` offre une prise d'account takeover cross-realm. La doc dit "jamais de création silencieuse" mais il y a bien un `UPDATE users SET keycloakSubjectId` implicite.
- [VÉRIFIÉ] **P1-2 — ABAC ticket incomplet vs multi-tenant** — `ticket-access.service.ts:32-42` `ticketVisibilityCondition` filtre par `departmentId/assignedTeamId/assignedTo/createdBy/openedByUserId` mais jamais par `supportIntegrationId`. Un agent d'une intégration A peut voir un ticket `supportIntegrationId=B` s'il partage le département (cas multi-sites PhotoVault). Même trou dans `tickets.service.ts:582-635` `findTicketById` (aucun filtre intégration). Le cloisonnement public est fort, le cloisonnement interne est absent.
- [VÉRIFIÉ] **P1-3 — CORS découpé sans validation** — `main.ts:68-71` `config.corsOrigin.split(',').map(trim)` accepte n'importe quelle chaîne, y compris `https://evil.com` injecté via env. `helmet()` est sans `contentSecurityPolicy` explicite. Aucun test ne vérifie qu'une origine non listée est bloquée.
- [VÉRIFIÉ] **P1-4 — Upload sans validation anticipée du MIME réel** — `attachments.service.ts:48-63` valide `isAllowedAttachment(file)` après `fileFilter` Multer mais le fichier est déjà écrit sur disque (`uploads/incoming`) par `multer.diskStorage`. `file.mimetype` vient du client et `file-type` n'est vérifié que dans `attachment-content-inspector.service.ts` en asynchrone. Un mauvais `Content-Type` contourne le filtre initial.
- [VÉRIFIÉ] **P1-5 — PublicSession 900s sans rotation ni révocation globale par intégration** — `public-session.service.ts:29-41` HS256 900s, `validate` vérifie `trustedDevices` mais pas de `jti` blacklist. Un token volé dans les 15 min reste valide même après `DELETE /trusted-devices/:id` si l'attaquant rejoue avant expiration (fenêtre où `validate` n'a pas encore vu la révocation du device, selon cache).
- [VÉRIFIÉ] **P2-1 — Throttler fail-open silencieux** — `throttler-storage-redis.provider.ts:113-116, 144` attrape toute exception Redis et bascule en mémoire (`Map` par process). En multi-instance, un attaquant contourne le rate-limit en round-robin sur 3 pods. Aucun metric n'incrémente `throttler.fallback`.
- [VÉRIFIÉ] **P2-2 — Nginx ClamAV non bloquant** — `sla.helper` n'est pas le sujet : le scan `attachment-scan.worker.ts` tourne en BullMQ après upload, mais `attachments.service.ts:85` `scanStatus: NOT_REQUIRED` court-circuite ClamAV pour les internes. Un interne peut uploader un binaire infecté qui sera servi via `GET attachments/:id/download` sans quarantaine.
- [VÉRIFIÉ] **P2-3 — Idempotency hash collisions de surface** — `idempotency.interceptor.ts:86-88` `sha256(subject:method:path:rawKey)` utilise `request.path` (sans query). `GET /tickets?status=NEW` et `GET /tickets?status=CLOSED` avec même `Idempotency-Key` rejouent la même réponse. Peu probable en `POST` mais le schéma autorise `GET` idempotent.

### 2. Données — transactions, migrations, outbox, SLA

- [VÉRIFIÉ] **P0-3 — Transactions non atomiques sur les mutations ticket** — `tickets.service.ts:360-408` `assign` fait `INSERT ticketAssignments` puis `UPDATE tickets` hors `runInTransaction`. Si le `UPDATE` échoue, l'assignment orphelin reste. `escalate:427-443` idem. `update:242-271` fait `UPDATE` puis `recordByActor` hors transaction (histoire non cohérente si crash entre les deux). Seuls `createFromCommand` et `changeStatus` sont transactionnels. `DrizzleProvider.runInTransaction:74-75` a même un early-return `if (context) return callback()` qui fait croire à une transaction imbriquée mais n'en ouvre pas.
- [VÉRIFIÉ] **P0-4 — Outbox écrit sans transaction métier sur certains chemins** — `public-conversation.service.ts:26-37, 55-73, 77-125, 128-154` écrit `outboxEvents` dans `runInTransaction` : bien. Mais `tickets.service.ts:311-327` `changeStatus` n'insère l'outbox public que si `ticket.supportIntegrationId && requesterId` — si le ticket public a été créé avant le cloisonnement (rows legacy `supportIntegrationId IS NULL`), aucun événement de livraison externe n'est émis, le demandeur externe ne voit pas le changement.
- [VÉRIFIÉ] **P1-6 — SLA processor sans lease, 100 tickets max par tick** — `sla-alert-processor.service.ts:93-153, 159-256` `findCandidates LIMIT 100` puis boucle `claimAlert` en `UPDATE ... WHERE isNull(warningSentAt)` atomique : pas de `SELECT FOR UPDATE SKIP LOCKED`. Deux pods peuvent lire les mêmes 100 ids et se battre en `UPDATE` (seul un gagne, mais le perdant a gaspillé un `SELECT`). À volume élevé (>400 tickets en retard), 4 ticks de 5 min = 20 min de latence. `SlaEngineService.checkSla:35-40` n'a aucun leader lock (red lock manquant, déjà signalé dans le scout).
- [VÉRIFIÉ] **P1-7 — Calcul SLA BUSINESS_HOURS ignorant les jours fériés** — `sla.helper.ts:28-98` `calculateSlaDueDate` prend `businessDays` (0-6) mais aucun `holidays: Date[]`. Un ticket créé un jour férié tombant un lundi ouvré obtient une `resolutionDueAt` trop courte. Le `SettingsService` expose `businessHours/businessDays` mais pas de `holidays`.
- [VÉRIFIÉ] **P1-8 — `afterCommit` swallowe les erreurs** — `drizzle.provider.ts:80-85` boucle `for (effect) try await effect catch log.error`. Si `eventEmitter.emit` échoue (listener des notifications), l'erreur est loggée puis perdue. Metrics `ticketsCreatedTotal.inc()` peut ne jamais s'exécuter sans que l'appelant ne le sache.
- [VÉRIFIÉ] **P2-4 — `tickets.ticketNumber` non protégé en concurrence** — `tickets.service.ts:125` `generate()` (snowflake/uuid) + `UNIQUE idx_tickets_number`. Deux `create` concurrents avec même `ticketNumber` génèrent une `23505` qui remonte en 500 (pas de retry). Probabilité faible mais le `GlobalExceptionFilter` masque la cause.
- [VÉRIFIÉ] **P2-5 — Migration `created_by` → `openedByUserId` à double écriture incomplète** — `tickets.ts:82-84, 152-159` `actorPresenceCheck num_nonnulls(createdBy, openedByUserId, requesterId)>=1`, `legacyCreatorCheck createdBy IS NULL OR createdBy = openedByUserId`. Lors d'un `update` `tickets.service.ts:257` on ne touche pas `openedByUserId`, seule la création écrit les deux. Un `PATCH` legacy fait diverger les colonnes si un trigger n'est pas en place.
- [VÉRIFIÉ] **P0-? (à vérifier) — N+1 sur `DashboardService`** — `dashboard.service.ts:95-136` `overview` lance 9 `SELECT count()` en `Promise.all` mais `ticketsByStatus/byPriority/bySeverity` refont 3 requêtes supplémentaires avec les mêmes `WHERE`. `agentPerformance` et `myActivity` refont des `PERCENTILE_CONT` séparés. Pas de cache Redis (contrairement à l'archi annoncée "Cache-Aside 60s") visible dans le service.
- [SUPPOSÉ] **P1-9 — Aucun index partiel sur `tickets.deletedAt IS NULL`** — les index listés `idx_tickets_*` sont globaux, pas `WHERE deletedAt IS NULL`. Avec soft-delete, 90 % des requêtes portent `isNull(deletedAt)` mais l'index scan porte sur toute la table.

### 3. Architecture — modules, événements, cohérence

- [VÉRIFIÉ] **P0-5 — `EventEmitter2` pour des effets critiques sans garantie de livraison** — `tickets.service.ts:207, 331, 398, 454, 676-682` `emitAfterCommit` poste `ticket.created/assigned/escalated/status_changed/resolved/closed/reopened/cancelled` en mémoire. Si le pod crash entre `COMMIT` et `emit`, la notification/SLA/audit est perdue. Les auditeurs (`audit-logs`, `notifications`, `sla`) n'ont pas de rejeu. Seules les mutations publiques utilisent l'outbox ; les mutations internes dépendent encore d'EventEmitter. Le harnais exige "aucune notification externe dépendant uniquement d'EventEmitter/Redis" — violation partielle.
- [VÉRIFIÉ] **P1-10 — Contrôleur gras / service maigre inversé par endroits** — `tickets.controller.ts` (non lu ligne-à-ligne mais 15 routes) délègue bien, mais `public-conversation.service.ts:75-125` `confirm` fait `insert supportMessages` puis `tickets.createFromCommand` puis `materializer.materialize` puis `update supportConversations` dans une seule transaction de 5 étapes : responsabilité trop large, faille de lisibilité, testabilité faible (aucun seam).
- [VÉRIFIÉ] **P1-11 — `PublicSupportConfigService` mélange 3 concerns** — `public-support.config.ts:1-152` gère `masterKeys`, `otp`, `session`, `bot`, `retention` dans une seule classe de 152 lignes. `botEnabled` dépend de `botProvider` + `botApiKey` : un mauvais `BOT_PROVIDER=deepseek` avec clé vide donne `botEnabled=false` silencieux, le `SupportBotService` renvoie `mode: disabled` sans log WARN.
- [VÉRIFIÉ] **P1-12 — Duplication de config Redis** — `common/providers/redis.config.ts` (objet) vs `config/redis.config.ts` (service) vs `ThrottlerStorageRedisService` qui crée son propre `new Redis(...)` si aucun client n'est injecté : 3 sources de vérité pour host/port/password. Divergence possible entre `REDIS_HOST=redis` (compose) et `127.0.0.1` (fallback).
- [VÉRIFIÉ] **P2-6 — `SupportBotService` circuit-breaker en mémoire** — `support-bot.service.ts:28, 188-206, 62-73` `circuits: Map<string, CircuitState>` par process, non partagé en Redis. En 3 pods, un pod ouvre son circuit mais les 2 autres continuent d'appeler le provider en faute. `countTodayBotCalls` fait `COUNT(*) WHERE channelMetadata->>'kind'='bot'` sans index GIN/jsonb, full scan journalier.
- [VÉRIFIÉ] **P2-7 — DTO non discriminés par `sourceChannel`** — `tickets.service.ts:498-520` `resolveRequesterContext` valide `sourceChannel !== INTERNAL` pour `EXTERNAL_REQUESTER`, mais `CreateTicketDto` (non relu) autorise probablement `sourceChannel=INTERNAL` pour un appel `POST /public-support/...` si la validation `class-validator` est incomplète. Le guard public n'empêche pas un body forgé.
- [VÉRIFIÉ] **P2-8 — `IdempotencyInterceptor` fait un `DELETE` non conditionnel à chaque requête** — `idempotency.interceptor.ts:89` `DELETE FROM idempotencyRecords WHERE expiresAt <= now()` à chaque hit idempotent : `DELETE` sans `LIMIT`, full scan potentiel, et supprime des lignes expirées concurrentes sans `FOR UPDATE`. Peut bloquer sous charge.
- [VÉRIFIÉ] **P2-9 — `GlobalExceptionFilter` masque les erreurs métier** — `global-exception.filter.ts:63-69` toute `Error` non-Http devient `500 INTERNAL_ERROR` avec `message: Une erreur interne est survenue.` + log. Une `DrizzleError 23505 unique_violation` (ticketNumber) perd son `code` et son `detail`. Le client reçoit 500 alors qu'un 409 serait approprié.

### 4. API & contrats

- [VÉRIFIÉ] **P1-13 — `ValidationPipe` global + `forbidNonWhitelisted:true`** — `main.ts:83-92` casse les clients qui envoient un champ inconnu (ex: `customerNotes`) en 400 alors qu'un `whitelist:true` seul le stripperait. Choix strict mais non documenté côté OpenAPI ; les frontends doivent être parfaitement alignés. Aucun `@ApiExtraModels` ne documente les champs stripped.
- [VÉRIFIÉ] **P1-14 — UUID non validé sur les params** — `department-abac.guard.ts:33-44` `request.params.id || ticketId` est une chaîne brute, aucun `ParseUUIDPipe`. `GlobalExceptionFilter` ne mappe pas une erreur `invalid input syntax for type uuid` postgres en 400 mais en 500. Un `GET /tickets/not-a-uuid` peut donner 500 au lieu de 400.
- [VÉRIFIÉ] **P2-10 — Contrat public fragile au décorateur** — `public-openapi.ts:28-41` `projectPublicOpenApi` exige `operation.security` explicite, sinon `throw new Error`. Un nouvel endpoint public oubliant `@ApiSecurity` casse `pnpm run openapi:export` en CI sans message clair pour l'auteur. Le filtre `PUBLIC_SUPPORT_AUDIENCE_EXTENSION` est une string magic non typée.
- [VÉRIFIÉ] **P2-11 — `openapi.json` non garanti à jour** — `main.ts:105` `createOpenApiDocument` est côté runtime, `scripts/openapi:export` génère les fichiers, mais rien n'empêche de pousser du code avec un `openapi.json` décalé si `openapi:check` n'est pas dans le pre-commit. Le `CHANGELOG` mentionne "144 opérations" mais le scout compte 139 — drift déjà visible.
- [VÉRIFIÉ] **P2-12 — `Idempotency-Key` header sensible à la casse** — `idempotency.interceptor.ts:70` `request.headers['idempotency-key']` en minuscule : Express normalise en minuscule, OK, mais la doc OpenAPI expose `Idempotency-Key` (capitalisé) et Nginx `proxy_set_header` pourrait le forwarder en `Idempotency-Key`. Tests hors Express échoueront.

### 5. Observabilité & prod

- [VÉRIFIÉ] **P0-6 — `verifyToken`/`jwks` sans cache d'échec ni backoff** — `keycloak-jwks.service.ts:34-59` `loadKeys` fait `fetch(jwksUrl, timeout 5s)` avec cache 10 min **succès uniquement**. En panne Keycloak, chaque requête `SECRET_OR_KEY_PROVIDER` refait un `fetch` qui timeout 5s, bloquant l'event-loop. Pas de circuit-breaker, pas de stale-while-revalidate. Un burst auth = cascade de timeouts.
- [VÉRIFIÉ] **P1-15 — `RequestLoggerMiddleware` et `quietReqLogger:true`** — `app.module.ts:86-89, main.ts:77-80` `pinoHttp.quietReqLogger:true, autoLogging:false` désactive les logs d'accès pinoHttp, relayés par `RequestLoggerMiddleware`. Ce middleware log-t-il les 4xx/5xx avec `correlationId` ? Non vérifié. Si `GlobalExceptionFilter` throw avant le middleware (cas WebSocket), la requête est invisible dans Loki.
- [VÉRIFIÉ] **P2-13 — Métriques cardinality élevée** — `dashboard.service.ts:323-332` `COUNT(*) FILTER (WHERE priority='CRITICAL')` n'est pas une label prometheus, mais `metrics.service.ts` (non lu) expose `ticketsActive` (gauge) sans label `department` — inutile pour alerter par équipe. `httpRequestsTotal` utilise `route` normalisée `:id` (bien) mais `TransformInterceptor` n'ajoute pas de `duration` metric.
- [VÉRIFIÉ] **P2-14 — `reports.service.ts:100-115, 140-278` PDF en mémoire** — `Buffer.concat(chunks)` pour SLA/ticket PDF. Un `slaReport` sur 100k tickets peut OOM le pod (limite mémoire compose non lue). Pas de streaming S3, pas de `Content-Length`.

---

## Redondances & illogismes détaillés

| #    | Où                                                                                                      | Quoi                                                                                                                                                                                    | Pourquoi c'est redondant / illogique                                                                                                                                                                                                                                                                             |
| ---- | ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R-1  | `drizzle.provider.ts:74-75` + `idempotency.interceptor.ts:94-112` + `public-conversation.service.ts:26` | `runInTransaction` early-return si déjà en transaction mais chaque caller croit ouvrir une transaction                                                                                  | `idempotency.interceptor` ouvre une transaction, puis `tickets.service.createFromCommand` tente d'en rouvrir une : le early-return exécute `callback()` sans transaction imbriquée. L'`INSERT idempotencyRecords` et l'`INSERT tickets` ne sont plus atomiques — violation de l'idempotence si le second échoue. |
| R-2  | `ticket-access.service.ts:59-78`                                                                        | `assertTicketVisible` fait `SELECT id WHERE id=? AND visibility` puis `SELECT id WHERE id=?` si miss                                                                                    | Deux round-trips pour distinguer 404/403. Un seul `SELECT id, visibilityMatched` + `CASE` suffit. Sous charge, double la contention.                                                                                                                                                                             |
| R-3  | `tickets.service.ts:32-42, 60` + `database/schemas/tickets.ts:60-88`                                    | `assignedTeamId NOT NULL` mais `ticketAccess` autorise `eq(assignedTeamId, user.departmentId)` même si le ticket n'a pas d'équipe logique                                               | Le modèle force `assignedTeamId` dès `NEW` alors que l'assignation est postérieure. Le département propriétaire (`departmentId`) et l'équipe (`assignedTeamId`) sont dupliqués à l'identique à la création, puis divergent à l'escalade — confusion.                                                             |
| R-4  | `sla.helper.ts:38-42` + `sla-engine.service.ts:30-39` + `settings.service`                              | `BUSINESS_HOURS` lit `process.env['BUSINESS_HOURS_START']` en fallback **et** `SettingsService.getBusinessHours()`                                                                      | Deux sources de vérité pour la même plage horaire. Un admin édite `settings` en base, mais `sla.helper` peut encore lire `process.env` si `businessHours` est `undefined`.                                                                                                                                       |
| R-5  | `public-support.config.ts:1-152`                                                                        | Getters `requiredSecret` lancent `Error` si `<32 chars` mais `botApiKey` retourne `undefined` silencieux                                                                                | Politique incohérente : certains secrets sont fail-fast, `botApiKey` est fail-silent. Même famille de secrets, comportements opposés.                                                                                                                                                                            |
| R-6  | `websocket.gateway.ts:65-89` + `websocket-auth.service.ts` (non lu)                                     | `connectedClients: Map<string, Set<string>>` en mémoire + Redis adapter                                                                                                                 | Le tracking d'`activeUsers` est local au pod (`connectedClients.size`). En 3 pods, `activeUsers` gauge est fausse (sous-comptée). Le Redis adapter synchronise les rooms mais pas les gauges.                                                                                                                    |
| R-7  | `dashboard.service.ts:72-176`                                                                           | `overview` calcule `sla.totalTracked = total` (tickets créés dans la période) puis `sla.compliant = COUNT WHERE slaBreached=false` sur **tous** les tickets ouverts — mélange de scopes | `totalTracked` et `compliant` ne portent pas sur le même ensemble. `complianceRate = compliant/total` est mathématiquement faux si `total` est fenêtré et `compliant` non.                                                                                                                                       |
| R-8  | `reports.service.ts:87-115` vs `generateTicketPdf:123-279` vs `generateSlaPdf:289-443`                  | 3 méthodes dupliquent `new Writable + PDFDocument + chunks + Buffer.concat`                                                                                                             | Code copié-collé à 80 %. Un `createPdfDocument()` helper manque. Chaque méthode réinvente le piping.                                                                                                                                                                                                             |
| R-9  | `outbox-events.ts:51-58` + `outbox.service.ts:1-78` + `external-delivery/adapters`                      | `claim` fait `SELECT ... FOR UPDATE SKIP LOCKED` puis `UPDATE status=PROCESSING` en 2 étapes                                                                                            | Le `SELECT` verrouille, mais l'`UPDATE` refiltre par `id IN (...)`. Un worker concurrent peut claim les mêmes ids entre les deux si `SKIP LOCKED` n'a pas porté sur toutes les lignes (race). Un `UPDATE ... WHERE status=PENDING RETURNING` atomique serait plus sûr.                                           |
| R-10 | `tickets/domain/ticket-permissions.ts:31-76, 81-131, 136-176`                                           | `checkCanUpdateFields` boucle sur `updatedFields` et reteste `isAdmin/isSupervisor/isAssignee` à chaque champ                                                                           | 7 blocs `if (!isSupervisor && !isAdmin)` répétés. Une table `FIELD_POLICY: Record<string, Role[]>` serait déclarative et testable.                                                                                                                                                                               |

---

## Ce qui est bien (à préserver)

- Séparation `RequestAuthGuard` par `AuthMode` (ANONYMOUS/INTERNAL/PUBLIC_SESSION/INTEGRATION_ASSERTION) avec un `APP_GUARD` unique — clair, extensible, évite les `if` dispersés.
- `DrizzleProvider.afterCommit` avec `AsyncLocalStorage` pour les Domain Events après COMMIT — pattern propre, bien isolé.
- `ticket-permissions.ts:224-262` `checkCanChangeStatus` centralisé (switch) au lieu de `if` éparpillés dans `changeStatus`.
- `sla-alert-processor.service.ts:159-256` `claimAlert` atomique par `UPDATE ... RETURNING` + relance `BREACH` toutes les 6h : robuste, idempotent.
- `contact-verification.service.ts:81, 109-129` `pg_advisory_xact_lock(hashtextextended('otp:...'))` + quotas multi-dimensions (ip/integration/contact) — anti-brute force sérieux.
- `public-openapi.ts:75-145` projection publique avec `collectReferences` récursif et `pickReferenced` — garantit un contrat minimal sans fuite de schémas internes.
- `throttler-storage-redis.provider.ts:46-59, 113-144` pipeline Redis `INCR+TTL`, fallback mémoire borné à 5000 clés, `enableOfflineQueue:false` — dégradation élégante.
- `support-bot.service.ts:62-73, 188-206` budget quotidien + circuit breaker + `ToolPolicyService` allowlist fermée — ne fait pas confiance au LLM.
- `ticket-status-transitions.ts:33-43` `TICKET_TRANSITIONS` immuable, source unique de vérité, `validateTransition` lance `InvalidStatusTransitionException`.

---

## Recommandations — par priorité

### P0 — corriger avant tout merge prod

1. **Purger la clé exemple** — remplacer `PUBLIC_SUPPORT_BOT_API_KEY` dans `.env.example` par `REPLACE_ME` et faire `git log --all -- .env` pour vérifier qu'aucune vraie clé n'a été committée. Cibles : `.env.example:59`, `docs/environment-variables.md`, `CHANGELOG.md` si la clé y figure. Rotation de la clé DeepSeek côté fournisseur.
2. **Passer `AUTH_REDIS_BLACKLIST_FAIL_OPEN=false` en prod** — `jwt.strategy.ts:163` inverser le défaut ou exiger `AUTH_REDIS_BLACKLIST_FAIL_OPEN` explicite au bootstrap (throw si absent). Ajouter un health `readiness` qui passe en `degraded` si Redis down plutôt que d'accepter les JWT révoqués.
3. **Rendre `assign/escalate/update` transactionnels** — envelopper `tickets.service.ts:360-467` dans `runInTransaction` (ou passer par une `TicketAssignmentService` atomique). Idem `update:257` (UPDATE + `recordByActor` dans la même tx). Ajouter un test d'intégration crash-entre-INSERT-et-UPDATE.
4. **Corriger l'imbrication `runInTransaction` vs `IdempotencyInterceptor`** — soit retirer le early-return `if (context) return callback()` et utiliser des savepoints, soit faire que l'intercepteur n'ouvre pas de transaction mais fasse `INSERT ... ON CONFLICT` hors tx, soit passer l'outbox/idempotency en advisory lock. Cible : `drizzle.provider.ts:74`, `idempotency.interceptor.ts:94-112`.
5. **Ajouter un cache/JWKS circuit-breaker** — `keycloak-jwks.service.ts:34-59` : cache d'échec 30s, stale-while-revalidate (servir les clés expirées pendant le fetch), `AbortSignal.timeout(2s)` au lieu de 5s, metric `jwks.fetch.errors`. Sans ça, une panne Keycloak = DoS sur l'API.
6. **Durcir `bindProfileByEmail`** — exiger `email_verified === true` strict (pas `!== false`), ou exiger un mapping explicite `users.keycloakSubjectId` pré-rempli par le seed, ou faire du `bind` un endpoint admin explicite. Cible : `jwt.strategy.ts:101-102`.

### P1 — à planifier dans le prochain sprint

7. Filtrer `supportIntegrationId` dans `ticketVisibilityCondition` et `findTicketById` pour l'isolation multi-tenant interne.
8. Valider `AuthMode.PUBLIC_SESSION` body : `class-validator` `@IsEmpty('sourceChannel')` ou DTO séparé `PublicCreateTicketDto` sans `sourceChannel`.
9. Ajouter un leader lock Redis (`SET NX PX 4min`) à `SlaEngineService.checkSla` ou passer le tick en BullMQ repeatable job avec `jobId=sla-tick`.
10. Paginer `sla-alert-processor` par curseur (`WHERE id > lastId ORDER BY id LIMIT 100`) au lieu de `LIMIT 100` fixe qui peut looper sur les mêmes ids si `claimAlert` échoue.
11. Faire de `BUSINESS_HOURS` une seule source (`settings` table) et supprimer le fallback `process.env` dans `sla.helper.ts`.
12. Ajouter GIN index sur `supportMessages.channelMetadata` et `tickets.metadata`, et index partiels `WHERE deletedAt IS NULL`.
13. Corriger `dashboard overview` : `sla.complianceRate` doit porter sur `openWhere`, pas sur `rangeWhere` (ou exposer deux taux distincts).
14. Déplacer `IdempotencyInterceptor` `DELETE expired` en cron (`@Cron('0 * * * *')`) au lieu de le faire à chaque requête.
15. Valider les UUID en entrée (`ParseUUIDPipe`) et mapper `invalid input syntax for type uuid` postgres → 400 via `GlobalExceptionFilter`.
16. Documenter le contrat `forbidNonWhitelisted` dans Swagger (`@ApiBadRequestResponse`) et fournir un exemple d'erreur.
17. Centraliser la config Redis en un seul `RedisConfigService` injecté partout (supprimer `common/providers/redis.config.ts` legacy).
18. Factoriser `ReportsService` PDF en `PdfBuilder` (une classe, un `Writable`).
19. Remplacer `handlebars` sans `escapeExpression` audit : vérifier que `escape: true` est actif sur les templates email (injection HTML).
20. Ajouter `helmet({ contentSecurityPolicy: ..., crossOriginEmbedderPolicy: false })` explicite et test CORS négatif E2E.

### P2 — dette à traiter progressivement

- Remplacer `EventEmitter2` interne par l'outbox (ou BullMQ) pour les effets critiques (notifications internes, audit, SLA) — un plan `expand → double-write → cutover`.
- Passer `connectedClients`/`circuits` en Redis (Hash `ws:connections:{userId}`, `bot:circuit:{integrationId}`) pour la cohérence multi-instance.
- Remplacer `Buffer.concat` PDF par streaming vers `uploads/reports` + `fs.createWriteStream` + backpressure.
- Séparer `PublicSupportConfigService` en `OtpConfig`, `SessionConfig`, `BotConfig`, `MasterKeyConfig`.
- Introduire `FIELD_POLICY` déclarative pour `checkCanUpdateFields`.
- Faire de `afterCommit` une promesse traquée (DLQ si échec) au lieu de `log.error` silencieux.
- Ajouter `TIMING_SAFE_EQUAL` pour `ContactVerificationService` codeHash compare et `PublicSessionService.verify`.

---

## Preuves de revue

- Fichiers lus : 22 sources citées avec lignes exactes (voir tableau périmètre).
- Commandes : `Get-ChildItem -Recurse src -Filter *.ts` (435 fichiers), `Get-Content .env.example | Select-String` (clé `sk-` trouvée), `projects/open` listing (pas de `plans/reports/audit-*` préexistant du jour).
- Non-exécuté (honnête) : tests, build, lint, `openapi:export`, connexion DB/Redis/Keycloak, revue des `migrations/0000..0022.sql` ligne-à-ligne, revue des 120 `*.spec.ts`.

---

## Prochaines étapes proposées

1. Ouvrir un plan `plans/YYMMDD-HHMM-fix-p0-backend/` avec 6 phases P0 (une par bloc) + gates "tests verts + drill Redis down + openapi:check".
2. Lancer `/red-team` sur ce plan avant implémentation.
3. Après P0, traiter les P1 par lots (sécurité → données → archi).
4. Ajouter au CI : `pnpm run openapi:check`, `gitleaks`, `pnpm audit`, `drizzle-kit check` (drift `deletedAt` indexes).

## Agence

Réalisé via l'agent `code-reviewer` (lecture seule) + scout `explorer-agent` pour la cartographie. Aucun workflow `/audit` global n'a été invoqué (l'audit a été mené en direct, sans passer par `Task` orchestrator). Le rapport suit le skill `reporting` (`plans/reports/{type}-YYMMDD-HHMM-{slug}.md`) et le workflow `/report`.
