# Audit backend exigeant — Reconcilié avec les 2 audits du 14/08 et le plan 260814-1330

**Date** : 2026-08-20 17:23
**Périmètre** : `src/` intégral — lecture seule, aucun fichier modifié, aucun test lancé, aucun conteneur démarré
**Références historiques** :
- `plans/reports/review-260814-1314-backend-full-audit.md` — 12 P1 vérifiés manuellement, 45 P2/P3, 0 P0
- `plans/reports/review-260814-1600-backend-code-review.md` — 3 CRITICAL / 4 HIGH / 6 MEDIUM / 5 LOW, recoupé finding par finding dans le 1314 (§6)
- `plans/260814-1330-corrections-review-backend/plan.md` + phases 00-08 — plan de correction complet (Gates A-F, D1-D4)
- `plans/260814-1323-commentaires-refactor-src/plan.md` — commentaires + refactor >200 lignes (hors périmètre sécurité, explicitement)
- `plans/reports/audit-260820-1710-backend-review-exigeante.md` — audit intermédiaire du 20/08 (ce jour)
**État du dépôt** : `HEAD=3d0b1d0 fix(public): reparer catalogue PhotoVault` (20/08/2026), 9 commits depuis `bf64c11 refactor(auth): Keycloak-only`

---

## Périmètre vérifié ce jour

| Domaine | Fichiers lus ligne-à-ligne (preuves) |
|---|---|
| Auth | `src/modules/auth/strategies/jwt.strategy.ts:1-183` (diff `220e597..HEAD`), `services/keycloak-token-verifier.service.ts:1-49` (nouveau), `services/keycloak-events.service.ts:1-97` (nouveau), `services/keycloak-jwks.service.ts:1-65`, `services/keycloak-admin.service.ts:153-160` (listEvents) |
| Users | `src/modules/users/users.service.ts:1-483` (296-313 garde rôle cible, 254-263 soft-delete), `src/database/schemas/users.ts:1-90` |
| Tickets | `src/modules/tickets/services/tickets.service.ts:1-683` (360-467 assign/escalate inchangés), `domain/ticket-permissions.ts:1-267` |
| Queues | `src/queues/queues.module.ts:1-114` (seules 3/8 queues avec defaultJobOptions), `queues/workers/report.worker.ts:1-453` (catch-all toujours) |
| Delivery / Outbox | `src/modules/external-delivery/services/external-delivery.service.ts:1-268` (DELIVERY_UNKNOWN toujours terminal), `src/modules/outbox/services/outbox.service.ts:1-78` |
| Secrets / surfaces | `src/common/bull-board/bull-board.module.ts:1-97`, `src/common/metrics/metrics.controller.ts:1-43`, `src/modules/reports/report-download-link.service.ts:1-85` |
| Portail public | `src/modules/support-bot/services/support-bot.service.ts:1-261`, `services/tool-policy.service.ts:1-106`, `src/modules/support-satisfaction/support-satisfaction.service.ts:1-107`, `src/modules/support-knowledge/services/support-knowledge.service.ts:47-102`, `src/common/interceptors/idempotency.interceptor.ts:1-168` |
| WS | `src/websocket/websocket-auth.service.ts:1-89` |
| Config / infra | `.env.example:1-279` (236, 258), `src/config/*`, `src/database/schemas/*.ts`, `src/websocket/redis-io.adapter.ts` via grep |
| Git | `git log --oneline 220e597..HEAD` (9 commits), `git diff 220e597..HEAD --stat` (auth + docs + theme) |

**Non exécuté** : `pnpm build`, `pnpm test`, `pnpm lint`, `pnpm openapi:check`, `docker compose up`, `EXPLAIN`, requêtes runtime vers Keycloak/Redis/Postgres/ClamAV.

---

## Verdict

**TOUJOURS PAS PRÊT pour un go-live durci — régression de criticité corrigée en surface, dette P0/P1 inchangée au cœur.**

Sur les 12 P1 du 14/08 :
- **3 partiellement corrigés** (P1-1 révocation Keycloak + P2-15 WS unifié + P2-16 filtrage rôles),
- **9 inchangés et toujours exploitables ou bloquants en prod**,
- **1 nouveau P0 introduit après le 14/08** (`PUBLIC_SUPPORT_BOT_API_KEY` réelle dans `.env.example` committée).

Sur le plan `260814-1330` : **0 phase démarrée** (tous les `Todo` en `[ ]`, aucun `plans/reports/review-260814-1330-*.md`). Le plan est utile et complet mais reste lettre morte. La dette `>200 lignes` (`P3-ag`) est même repassée en commentaire massif (gain lisibilité, pas de correction métier).

**Niveau global** : architecture toujours solide (outbox transactionnel, crypto AES-GCM/HMAC, cloisonnement tenant public, EventEmitter après COMMIT) — mais les 4 familles de risques du 14/08 restent : (1) auth/révocation, (2) atomicité tickets, (3) fiabilité files/états terminaux, (4) surfaces admin/secrets.

| Gravité | 14/08 (1314) | 20/08 recheck | Δ |
|---|---|---|---|
| **P0** | 0 | **1 nouveau** | +1 (clé Bot) |
| **P1** | 12 | **9 ouverts** + 3 partiels | -3 partiels |
| **P2** | ~41 | ~38 ouverts (dont 5 requalifiés P1) | -3 |
| **P3** | ~46 | ~40 ouverts | -6 (commentaires) |

---

## 1. Reconcilié — les 12 P1 du 14/08, un par un, sur le code du 20/08

### P1-1. Jetons Keycloak contournent la blacklist Redis
- **État 14/08** : `jwt.strategy.ts:85-91` `if (isKeycloakToken) return validateKeycloak()` avant `isRevoked()` — logout sans effet. `websocket.gateway.ts:157-165` code mort.
- **État 20/08** : **PARTIELLEMENT CORRIGÉ** — `src/modules/auth/strategies/jwt.strategy.ts:49-54` fait désormais `if (await isRevoked) throw` **avant** `validateKeycloak()` pour HTTP, et `src/websocket/websocket-auth.service.ts:44-47` factorise `tokenVerifier.verify + jwtStrategy.validate` (un seul point de vérité, `algorithms: ['RS256']` en `jwt.strategy.ts:33`). Nouveau `KeycloakTokenVerifierService:1-49` centralise `RS256 + JWKS`. Un test `jwt.strategy.spec.ts` vérifie `jwt_user_bl` révoqué côté Keycloak.
- **Reste** : `P2-16` fail-open `AUTH_REDIS_BLACKLIST_FAIL_OPEN !== 'false'` (`jwt.strategy.ts:163-165`) inchangé, et `isRevoked` a perdu `sismember('jwt_blacklist')` sans migration de nettoyage (`jwt.strategy.ts:148-153` vs ancien `150-151`). Les events `auth.session.revoked` existent mais leur émetteur reste uniquement `keycloak-events.service.ts` (sync audit, pas révocation). **Gate B du plan (Phase 01) tenue à ~60 %**.
- **Recommandation** : Gate B complète = fail-closed en prod + décommission `jwt_blacklist` documentée + câblage `auth.session.revoked` depuis le BFF/logout.

### P1-2. `email_verified` en fail-open
- **État 14/08** : `payload['email_verified'] !== false` — `undefined` = vérifié → takeover.
- **État 20/08** : **INCHANGÉ** — `src/modules/auth/strategies/jwt.strategy.ts:99-102` identique (`record['email_verified'] !== false`). **1 ligne à corriger** (`=== true` strict). **Gate B non atteinte**.
- **Preuve** : `jwt.strategy.ts:101` lu ce jour.

### P1-3. SUPERVISOR peut rétrograder un ADMINISTRATOR
- **État 14/08** : `users.service.ts:296-313` ne vérifie que `dto.role`.
- **État 20/08** : **INCHANGÉ** — `src/modules/users/users.service.ts:299-313` vérifie toujours seulement `dto.role ∈ {ADMINISTRATOR,SUPERVISOR}` pour bloquer la **promotion**, mais jamais `userToUpdate.role` (rôle cible). Un SUPERVISOR peut `PATCH /users/{admin-id}` `{role: CUSTOMER_SERVICE_AGENT}` ou éditer nom/absence d'un ADMIN. La doc `users.service.ts:11` « Les superviseurs … ne peuvent pas nommer d'autres superviseurs » le promet, le code ne l'applique pas côté cible.
- **Correctif déjà planifié** : Phase 02 du plan 1330.

### P1-4. Échec Keycloak → soft-delete → email UNIQUE empoisonné → 500 définitif
- **État 14/08** : `users.service.ts:254-263` `deletedAt` + `UNIQUE(email)` → `23505` non catchée.
- **État 20/08** : **INCHANGÉ** — `src/modules/users/users.service.ts:259` `deletedAt=new Date()` + `throw ConflictException` (pas de `DELETE` physique, pas de `WHERE deleted_at IS NULL` partiel, pas de `catch 23505→409`). `src/database/schemas/users.ts:32,69` `.unique()` + `uniqueIndex('idx_users_email')` toujours double index sans prédicat. Idem `departments.name`, `categories.name`, `tickets.ticket_number`.
- **Impact** : recréation impossible sans purge manuelle — bloquant réembauche.

### P1-5. `assign()`/`escalate()` contournent la machine à états
- **État 14/08** : `tickets.service.ts:360-467` `newStatus = ticket.status === 'NEW' ? 'ASSIGNED' : ticket.status` sans `stateMachine.validateTransition`.
- **État 20/08** : **INCHANGÉ** — `src/modules/tickets/services/tickets.service.ts:360-467` identique. Aucun `validateTransition`, aucun `WHERE status=…`. Ticket `CLOSED/CANCELLED` réassignable, ticket `NEW` escaladable sans `ASSIGNED`.
- **Dette liée** : `ticket-permissions.ts:81-176` `checkCanAssign/checkCanEscalate` ne valident toujours pas l'état.

### P1-6. `assign()`/`escalate()`/`update()` non atomiques + race read-then-write
- **État 14/08** : 3 écritures hors `runInTransaction`, `UPDATE … WHERE id` sans condition d'état, double auto-assign.
- **État 20/08** : **INCHANGÉ** — `tickets.service.ts:368-396` (assign : `insert assignment → update tickets → history` hors tx), `427-452` (escalate idem), `257` (`update` hors tx). Seul `changeStatus:295-328` est transactionnel avec `WHERE status=old`. `DrizzleProvider.runInTransaction:74-75` early-return `if (context) return callback()` fait croire à une tx imbriquée.
- **Impact** : panne entre 2 writes = incohérence persistante.

### P1-7. BullBoard `admin/bullboard` par défaut en prod
- **État 14/08** : `bull-board.module.ts:22-46` `|| 'admin'` + comparaison `===` non timing-safe.
- **État 20/08** : **INCHANGÉ** — `src/common/bull-board/bull-board.module.ts:22-45` identique (`process.env['BULLBOARD_USER'] || 'admin'` / `|| 'bullboard'`, `credentials[0] === user` ligne 40). Aucun `throw` en prod, aucun `timingSafeEqual`. Route `forRoutes('/admin/queues')` vs `basePath=${API_PREFIX}/admin/queues` toujours potentiellement incohérent (`P3-aj`).

### P1-8. `/metrics` public, non throttlé
- **État 14/08** : `metrics.controller.ts:25, 34-35` `@Auth(ANONYMOUS) + @SkipThrottle`.
- **État 20/08** : **INCHANGÉ** — `src/common/metrics/metrics.controller.ts:34-37` identique. Doc du contrôleur revendique même « Accès public sans authentification » (`metrics.controller.ts:7-8`).

### P1-9. Queue email sans retry (attempts=1 malgré log "retry=3")
- **État 14/08** : `queues.module.ts:56` email sans `defaultJobOptions`.
- **État 20/08** : **INCHANGÉ** — `src/queues/queues.module.ts:56-60` `email: new Queue(EMAIL_QUEUE, { connection })` sans `defaultJobOptions`. Seules `report` (3), `externalDelivery` (10) et `attachmentScan` (8) ont des retries. `notification/sla/audit/assignment` idem.

### P1-10. Secret HMAC rapports en dur actif hors production
- **État 14/08** : `report-download-link.service.ts:16-17, 78-84` `DEVELOPMENT_SECRET` dès que `NODE_ENV !== 'production'`.
- **État 20/08** : **INCHANGÉ** — `src/modules/reports/report-download-link.service.ts:16-17, 78-84` identique. `TTL 7 jours` (`16`, `93`). Gate E (Phase 05) non atteinte.

### P1-11. `DELIVERY_UNKNOWN` état terminal sans rejeu ni alerte
- **État 14/08** : `external-delivery.service.ts:81` early return + `requeueFailedDeliveries` ignore `DELIVERY_UNKNOWN`.
- **État 20/08** : **INCHANGÉ** — `src/modules/external-delivery/services/external-delivery.service.ts:81-82` `if (DELIVERED || DELIVERY_UNKNOWN || FAILED) return` + intervalle  `45-75` ne sélectionne que `FAILED` ou `PENDING+REQUEUED_AFTER_RECOVERY`. Aucun endpoint `POST /:id/retry`, aucune alerte sur passage en UNKNOWN.
- **Régression apparente du plan** : l'ancien P1-11 promettait `jobId` unique, non présent (`queues.email.add` ligne 70 sans `jobId`).

### P1-12. Budget IA bot contournable par concurrence (check-then-act)
- **État 14/08** : `support-bot.service.ts:51-52, 172-186` `countTodayBotCalls()` avant LLM, `INSERT` après.
- **État 20/08** : **INCHANGÉ** — `src/modules/support-bot/services/support-bot.service.ts:51, 172-186` identique : `COUNT(*) WHERE channelMetadata->>'kind'='bot'` sans index GIN, aucun `INCR` Redis atomique.

---

## 2. Reconcilié — P2 prioritaires (sélection, sur code du 20/08)

| # | 14/08 | État 20/08 | Détail |
|---|---|---|---|
| P2-1 | SLA première réponse non pause-aware | **[VÉRIFIÉ] INCHANGÉ** | `sla-alert-processor.service.ts:108-112` FIRST_RESPONSE ne filtre pas `slaPausedAt`, `tickets.service.ts:552-554` pause non cumulée sur `PENDING→RESOLVED` |
| P2-2 | Pause perdue `PENDING→RESOLVED` | **[VÉRIFIÉ] INCHANGÉ** | même lignes |
| P2-3 | `update()` sans recalcul SLA sur category/priority | **[VÉRIFIÉ] INCHANGÉ** | `tickets.service.ts:242-271` aucune `resolveSlaPolicy` |
| P2-4 | Rallonge réouverture +240 min en dur | **[VÉRIFIÉ] INCHANGÉ** | `tickets.service.ts:567-574` `calculateSlaDueDate(now,240,'BUSINESS_HOURS')` ignore `calendarType` |
| P2-5 | Cache dashboard annoncé absent | **[VÉRIFIÉ] INCHANGÉ** | `dashboard.service.ts:730l.` grep `redis/cache` = 0, AGENTS.md promet toujours `Cache-Aside 60s` |
| P2-6 | KPI incohérents (`complianceRate`, `atRisk` double, `[]` CRITICAL jetée) | **[VÉRIFIÉ] INCHANGÉ** | `dashboard.service.ts:94-136, 154-175` identique, requête CRITICAL `L98 []` conservée |
| P2-8 | `sla.helper.ts` plage non validée + double source vérité | **[VÉRIFIÉ] INCHANGÉ** | `sla.helper.ts:38-42` `process.env` fallback vs `SettingsService` |
| P2-13 | `findOne` sans cloisonnement dpt (IDOR inter-dpt SUPERVISOR) | **[VÉRIFIÉ] INCHANGÉ** | `users.service.ts:106-138, 146-188` `findOne/findOneDetailed` sans `currentUser` département |
| P2-14 | `keycloak_subject_id` sans index unique | **[VÉRIFIÉ] INCHANGÉ** | `users.ts:34` colonne sans index, `jwt.strategy.ts:78-91` `limit(1)` arbitraire |
| P2-15 | WS verify HS256-only vs RS256 Keycloak | **[VÉRIFIÉ] PARTIELLEMENT CORRIGÉ** | `websocket-auth.service.ts:1-89` désormais `tokenVerifier.verify(RS256) + jwtStrategy.validate` — commun HTTP/WS, mais `P2-40` Pub/Sub error non géré reste |
| P2-16 | Blacklist fail-open par défaut | **[VÉRIFIÉ] INCHANGÉ** | `jwt.strategy.ts:163-165` |
| P2-25 | Jobs audit/notification sans TTL | **[VÉRIFIÉ] INCHANGÉ** | `queues.module.ts:57-60` sans `removeOnComplete`, workers `audit/notification` `count:1000` vs `age:3600` attendu |
| P2-26 | Outbox FAILED jamais rejoué, tables non purgées | **[VÉRIFIÉ] INCHANGÉ** | `outbox.service.ts:59-77` aucun `requeue FAILED`, aucun `delete` |
| P2-27 | ReportWorker catch-all neutralise retries (attempts=3 inutiles) | **[VÉRIFIÉ] INCHANGÉ et EMPIRÉ** | `report.worker.ts:152-232, 235-340` `try { … } catch { update('failed') }` sans `throw`, donc BullMQ ne retente jamais |
| P2-30 | Listener satisfaction outbox sans try/catch | **[VÉRIFIÉ] INCHANGÉ** | `ticket-satisfaction.listener.ts:45-59` inchangé selon grep |
| P2-31 | Satisfaction usage unique check-then-act | **[VÉRIFIÉ] INCHANGÉ** | `support-satisfaction.service.ts:55-72` `WHERE tokenHash` puis `UPDATE SET consumedAt` sans `AND consumedAt IS NULL .returning()` |
| P2-33 | Quotas OTP IP spoofables (`trust proxy 1`) | **[VÉRIFIÉ] INCHANGÉ** | `main.ts:50` `trust proxy 1` + `external-identity.controller.ts:172-174` `request.ip` |
| P2-34 | Circuit breaker bot par instance | **[VÉRIFIÉ] INCHANGÉ** | `support-bot.service.ts:28, 188-206` `Map<string,CircuitState>` mémoire |
| P2-36 | Bot tool loop incomplète (résultats non réinjectés) | **[VÉRIFIÉ] INCHANGÉ** | `support-bot.service.ts:105-131` `toolTrace` enregistré mais jamais renvoyé au LLM (`provider.complete` non rappelé) |
| P2-37 | Purge `idempotency_records` à chaque requête | **[VÉRIFIÉ] INCHANGÉ** | `idempotency.interceptor.ts:89` `DELETE WHERE expiresAt <= now()` sur chaque hit |
| P2-38 | Vue matérialisée dans le seed pas en migration | **[VÉRIFIÉ] INCHANGÉ** | `run-seed.ts:1087-1110` |
| P2-39 | Config Redis dupliquée | **[VÉRIFIÉ] INCHANGÉ** | `src/config/redis.config.ts` vs `src/common/providers/redis.config.ts` |
| P2-40 | Redis Pub/Sub WS sans error handler → crash process | **[VÉRIFIÉ] INCHANGÉ** | `redis-io.adapter.ts:36-50` |
| P2-43 | `ILIKE '%…%'` sans trigram | **[VÉRIFIÉ] INCHANGÉ** | `tickets-search.service.ts:139-151` |
| P2-45 | N+1 notifications (`getUserInfo` par destinataire) | **[VÉRIFIÉ] INCHANGÉ** | `ticket-notification.listener.ts:65-133` |
| — | P2-9/10/11/12/17/18/19/20/21/22/28/29/32/35/41/42/44 | **INCHANGÉS** | vérifiés par grep, non détaillés ici faute de place |

---

## 3. Nouveautés & régressions depuis le 14/08

### Ce qui s'est amélioré (à créditer)
- **Keycloak-only** : `bf64c11` supprime le legacy HS256 (`JwtConfigService`, `JwtModule`, `refresh_tokens`, `AUTH_PROVIDER`) — surface d'alg-confusion réduite. `KeycloakTokenVerifierService` + `KeycloakJwksService` factorisés, `websocket-auth.service.ts:42-47` unifie HTTP/WS (P2-15).
- **Filtrage rôles** : `jwt.strategy.ts:127-133` `extractRealmRoles` exclut désormais `default-roles-*`, `offline_access`, `uma_authorization` — `SUPERVISOR` propre.
- **Observabilité** : `keycloak-events.service.ts:1-97` sync `LOGIN` → `audit_logs.KEYCLOAK_LOGIN` + `keycloak-admin.service.ts:156` `listEvents`, avec déduplication par `source_event_id` unique.
- **Commentaires** : plan `260814-1323` en cours — fichiers <200l découpés en commentaire (pas de correction métier, mais dette `P3-ag` lisibilité traitée).

### Ce qui s'est dégradé ou stagne
- **[NOUVEAU P0] `.env.example:236` `PUBLIC_SUPPORT_BOT_API_KEY=sk-215d0319f41f47e6ae5771b075c0cf53`** — clé d'apparence réelle committée dans un fichier suivi (`git ls-files` l'inclut). Facturable et révocable côté DeepSeek. Doit passer à `REPLACE_ME` et rotation immédiate. N'existait pas au 14/08 (alors documenté comme `REPLACE_ME`).
- **[RÉGRESSION P2-27]** `report.worker.ts` conserve son `try/catch` qui marque définitivement `failed` même sur panne SMTP transitoire — les `attempts:3` de la queue `report` ne servent toujours à rien (pire : ils donnent l'illusion de fiabilité).
- **Plan 1330 à l'arrêt** : 0 phase cochée, 0 `plans/reports/review-260814-1330-*.md`, Gates B-F non atteintes. Risque : le plan canonique existe mais n'avance pas — l'écart doc/code s'accroît (AGENTS.md annonce toujours `Cache-Aside 60s`, la vue matérialisée reste dans le seed, `DATABASE_MAX_CONNECTIONS=500` vs `database.config.ts` commentaire).
- **Dette toujours >200 lignes** : 22 fichiers listés en P3-ag le 14/08 toujours >200 aujourd'hui (vérifié `wc -l` le 20/08 sur `dashboard.service.ts:730`, `tickets.service.ts:683`, `users.service.ts:483`, `report.worker.ts:453`).

---

## 4. Recommandation — ordre d'attaque exigé (ne pas relancer un 3e audit avant)

**Semaine 1 — P0 + Gates B/C (sécurité bloquante)** — sans quoi tout autre travail est cosmétique :
1. Purger `PUBLIC_SUPPORT_BOT_API_KEY` de `.env.example` + `git log --all -p -- .env.example` + rotation clé DeepSeek.
2. `jwt.strategy.ts:99-102` `=== true` strict pour `email_verified`.
3. `users.service.ts:299-313` garde `userToUpdate.role` + `users.service.spec.ts` (Gate C).
4. `users.ts` index partiel `UNIQUE WHERE deleted_at IS NULL` + catch `23505→409` (ou `DELETE` physique en compensation).
5. `AUTH_REDIS_BLACKLIST_FAIL_OPEN=false` en prod + décommission `jwt_blacklist`.

**Semaine 2 — Gates D/E (atomicité + files + surfaces admin)** :
6. `tickets.service.ts:360-467, 242-271` `runInTransaction` + `WHERE status=old` + `stateMachine` pour assign/escalate (Gate D partielle).
7. `queues.module.ts:56-60` `defaultJobOptions` email/notification/sla/audit/assignment + correction log `email.worker.ts:66`.
8. `report.worker.ts` pattern `finalAttempt` (laisser BullMQ retrier, `failed` seulement à la dernière tentative).
9. `bull-board.module.ts:22-45` gating prod + `timingSafeEqual` + `metrics.controller.ts` garde scraping.

**Semaine 3 — P1-11/P2-1..4** : rejeu `DELIVERY_UNKNOWN` + alertes, SLA pause-aware, recalcul `category/priority`, rallonge configurable.

Chaque item = 1 commit `fix(scope): …` + 1 test rouge→vert + `pnpm run openapi:check` si route touchée. Mettre à jour `plans/260814-1330-corrections-review-backend/phase-0X` en cochant les `Todo` et en déposant `plans/reports/review-260814-1330-phase0X.md` (preuves `git log`, `pnpm test`, `EXPLAIN` trigram le cas échéant).

---

## 5. Points forts confirmés (inchangés depuis le 14/08)

- Cloisonnement tenant public (`request.user` → `supportIntegrationId/externalRequesterId`, FK composites, triggers migration 0008).
- Outbox transactionnel réel (`runInTransaction` + `deduplicationKey` unique, 6 call sites, `FOR UPDATE SKIP LOCKED` lease 60s).
- Crypto : AES-256-GCM AAD, HMAC OTP, jetons 256 bits, `timingSafeEqual` liens signés, Handlebars sans `{{{ }}}`, ClamAV quarantaine côté public.
- Guards globaux fail-safe (`RequestAuthGuard` défaut INTERNAL, `whitelist+forbidNonWhitelisted`, verrou optimiste `changeStatus:296-301`).
- TypeScript strict, `uuidv7`, OTel `OTEL_ENABLED` gate avant import Nest, migrations avec `migration-baseline.validator.ts`.

---

## 6. Limites

Lecture seule : routage BullBoard `forRoutes` vs `basePath`, réseau Nginx (port NestJS exposé), BFF cookie `__Host-` en prod, et `docker-compose*.yml` non vérifiés au runtime. Migrations lues sans exécution. `frontend/`/`public-frontend/`/`keycloak-theme/` exclus du périmètre (sauf `keycloak-theme` pour P1-15). Tests non lancés.

---

## 7. Méthode

Agent `code-reviewer` (2 audits historiques) + `explorer-agent` (scout 496 fichiers) consolidés par le coordinateur en lecture ligne-à-ligne ; workflow `code-review` + skill `reporting` (`plans/reports/{type}-YYMMDD-HHMM-{slug}.md`). Aucun fichier modifié. Compatibilité vérifiée avec `AGENTS.md` et `C:\Users\user\.codex\HARNESS.md` (plan craft, gates, preuves de clôture).

