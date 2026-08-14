# Rapport de Revue de Code — Audit Complet du Backend

**Date** : 14 août 2026
**Type** : Revue de code lecture seule (aucun fichier modifié)
**Périmètre** : `src/` intégral — 25 modules métier, `common/`, `config/`, `database/` (33 schémas, 20 migrations), `queues/` (8 files + 8 workers), `websocket/` (2 namespaces), `main.ts`, `app.module.ts`
**Méthode** : 5 sous-agents de revue en parallèle (périmètres disjoints) + vérification manuelle de chaque finding P1/P0 par l'agent coordinateur (lecture du code ligne à ligne)
**Workflow** : `code-review` (`codebase`) → consolidation → rapport `plans/reports/` (convention plan-craft)
**Statut** : ✅ Lecture seule — aucun fichier source modifié

---

## 1. Synthèse exécutive

### 1.1 Chiffres consolidés

| Gravité | Nombre | Définition |
|---------|--------|------------|
| **P0** | **0** | Faille exploitable directe (aucun P0 confirmé — bonne nouvelle) |
| **P1** | **12** | Bug réel, faille de sécurité sérieuse ou risque de production |
| **P2** | **~41** | Amélioration importante (fiabilité, perf, cohérence) |
| **P3** | **~46** | Dette cosmétique / qualité |

**Tous les 12 P1 ont été relus et confirmés manuellement** (fichier:ligne vérifiés).

### 1.2 Verdict

> **Le backend est d'un niveau globalement élevé** : architecture modulaire propre, guards globaux fail-safe, typage strict (zéro `any`/`@ts-ignore` en production), outbox pattern réellement transactionnel, crypto soignée (timing-safe, AES-GCM, ClamAV). **Aucun P0 exploitable n'a été trouvé**.
>
> Les risques majeurs sont concentrés sur : **(1)** la cohérence de la politique de sécurité des jetons (Keycloak contourne la blacklist, fail-open par défaut) ; **(2)** l'atomicité des mutations de tickets (assign/escalate hors transaction) ; **(3)** la fiabilité des files (queue email sans retry malgré le log « retry=3 », états terminaux sans issue) ; **(4)** les surfaces d'administration (BullBoard `admin/bullboard`, `/metrics` public) ; **(5)** les écarts doc ↔ code (cache dashboard annoncé absent, matrice RBAC en retard, « 24 politiques SLA » vs lookup inline).

### 1.3 Top 10 des constats à traiter en priorité

1. **P1** — Les jetons Keycloak (RS256, auth principale) **contournent totalement la vérification de révocation** Redis (`jwt.strategy.ts:86-88`) — logout/logoutAll sans effet côté API.
2. **P1** — `email_verified` en **fail-open** : claim absent = email considéré vérifié → binding de profil SSO possible sur email non vérifié (`jwt.strategy.ts:182`).
3. **P1** — Un **SUPERVISOR peut rétrograder un ADMINISTRATOR** de son département : la garde ne vérifie que le rôle attribué, jamais le rôle cible (`users.service.ts:296-313`).
4. **P1** — Échec de provisionnement Keycloak → soft-delete → **email bloqué définitivement** (contrainte UNIQUE + `deleted_at` incompatibles) → recréation impossible en 500 (`users.service.ts:254-263`, `users.ts:32`).
5. **P1** — `assign()`/`escalate()` **contournent la machine à états** : ticket CLOSED/CANCELLED assignable, escalade NEW sans transition (`tickets.service.ts:360-467`).
6. **P1** — `assign()`/`escalate()`/`update()` **non atomiques** : 3 écritures hors transaction, race de double auto-assignation (`tickets.service.ts`).
7. **P1** — **BullBoard `admin:bullboard`** par défaut en production + comparaison non timing-safe (`bull-board.module.ts:29-30`).
8. **P1** — **`/metrics` public et non throttlé** : volumétrie, routes, latences exposées (`metrics.controller.ts:34-35`).
9. **P1** — **Queue email sans retry** (attempts=1 par défaut) malgré le log « retry=3 » : emails perdus sur panne SMTP transitoire (`queues.module.ts:56`, `email.worker.ts:66`).
10. **P1** — **Secret HMAC des liens de rapports en dur** actif hors production → liens forgeables si `NODE_ENV` non défini (`report-download-link.service.ts:17`).

---

## 2. Constats détaillés — P1 (vérifiés manuellement)

### P1-1. Les jetons Keycloak contournent la vérification de révocation (blacklist Redis)
- **Fichier:ligne(s)** : `src/modules/auth/strategies/jwt.strategy.ts:85-91` (`validate()`), `:133-158` (`validateKeycloak()`)
- **Catégorie** : sécurité (authentification)
- **Détail** : `validate()` fait `if (this.isKeycloakToken(payload)) return this.validateKeycloak(payload);` **avant** le contrôle `isRevoked()`. `validateKeycloak()` ne vérifie jamais `jwt_bl:{jti}`, `jwt_blacklist` ni `jwt_user_bl:{sub}`. Or Keycloak est **l'authentification unique** du système (AGENTS.md).
- **Impact** : une session révoquée (logout, logoutAll, révocation admin) reste acceptée par l'API jusqu'à l'expiration naturelle du jeton. Les handlers WebSocket `auth.session.revoked` existent mais **rien ne les émet** (routes de logout supprimées, `websocket.gateway.ts:157-165` — code mort).
- **Correctif** : appliquer `isRevoked()` sur tous les types de jetons (déplacer l'appel avant le branchement Keycloak), et câbler l'émission des événements de révocation depuis le BFF/callback Keycloak.

### P1-2. `email_verified` en fail-open : binding SSO sur email non vérifié
- **Fichier:ligne(s)** : `src/modules/auth/strategies/jwt.strategy.ts:182` (`bindProfileByEmail`)
- **Catégorie** : sécurité (authentification)
- **Détail** : `const emailVerified = payload['email_verified'] !== false;` — si le claim est absent (fournisseur mal configuré, changement de provider), `undefined !== false` vaut `true`.
- **Impact** : le profil métier est lié (`keycloakSubjectId = subject`) sur la seule base de l'email → prise de contrôle de session possible si un IdP omet le claim.
- **Correctif** : exiger `payload['email_verified'] === true` (strict), et documenter le prérequis dans la config du realm.

### P1-3. Un SUPERVISOR peut modifier/rétrograder un ADMINISTRATOR de son département
- **Fichier:ligne(s)** : `src/modules/users/users.service.ts:296-313`, `src/modules/users/users.controller.ts:172-188`
- **Catégorie** : sécurité (RBAC)
- **Détail** : la garde vérifie `dto.role` (rôle **attribué**) mais jamais `userToUpdate.role` (rôle **cible**). Un SUPERVISOR peut `PATCH /users/{admin-id}` avec `{"role": "CUSTOMER_SERVICE_AGENT"}` et rétrograder un ADMIN, ou modifier nom/absence/disponibilité d'un ADMIN. La matrice RBAC AGENTS.md réserve « user management » SUPERVISOR = « Partial ».
- **Impact** : violation de la hiérarchie ; un superviseur compromis affaiblit les comptes administrateurs.
- **Correctif** : interdire à un SUPERVISOR toute modification d'un utilisateur dont le rôle cible ∈ {ADMINISTRATOR, SUPERVISOR} ; ajouter un test unitaire (aucun test ne couvre ce chemin aujourd'hui).

### P1-4. Échec Keycloak → soft-delete → email UNIQUE empoisonné → recréation impossible (500)
- **Fichier:ligne(s)** : `src/modules/users/users.service.ts:199-207, 254-263` ; `src/database/schemas/users.ts:32` (`.unique()`) + `:68` (`uniqueIndex`); `src/database/migrations/0000_baseline-current-schema.sql:106`
- **Catégorie** : logique / concurrence
- **Détail** : en cas d'échec Keycloak, la ligne insérée est soft-deletée (`deletedAt`) puis `ConflictException`. Le check d'unicité filtre `isNull(deletedAt)` (l'email semble libre) mais la contrainte `UNIQUE` PostgreSQL est sur `email` seul → violation `23505` non capturée → **500**. Aucune purge ni voie de recréation. Même schéma sur `departments.name`, `categories.name`, `tickets.ticketNumber`.
- **Impact** : email bloqué définitivement ; erreur générique trompeuse ; réembauche impossible sans purge manuelle.
- **Correctif** : `DELETE` physique en compensation, ou index unique partiel `WHERE deleted_at IS NULL`, ou capture de `23505` → 409 explicite.

### P1-5. `assign()`/`escalate()` contournent la machine à états
- **Fichier:ligne(s)** : `src/modules/tickets/services/tickets.service.ts:360-409` (assign), `:420-467` (escalate) ; `src/modules/tickets/domain/ticket-permissions.ts:81-131, 136-176`
- **Catégorie** : logique
- **Détail** : contrairement à `changeStatus` (qui valide `stateMachine.validateTransition`), `assign` calcule `newStatus = isAutoAssign ? 'ASSIGNED' : ticket.status === 'NEW' ? 'ASSIGNED' : ticket.status` et écrit sans validation d'état. Un superviseur peut assigner un agent sur un ticket **CLOSED/CANCELLED** ; `escalate` sur un ticket NEW pose un `assignedTo` sans transition `NEW → ASSIGNED` (le cron d'auto-assignation filtre `assignedTo IS NULL` → ticket fantôme).
- **Impact** : incohérences d'état persistantes, historique mensonger, tickets assignés jamais traités.
- **Correctif** : valider l'état dans `checkCanAssign`/`checkCanEscalate` (interdire CLOSED/CANCELLED, forcer la transition) ; rendre l'UPDATE conditionnel sur le statut (`where(and(eq(id), eq(status, oldStatus)))`).

### P1-6. `assign()`/`escalate()`/`update()` : écritures non atomiques + race read-then-write
- **Fichier:ligne(s)** : `src/modules/tickets/services/tickets.service.ts:368-396, 427-452, 257-267`
- **Catégorie** : concurrence
- **Détail** : trois `await` séquentiels hors `runInTransaction` (insert assignment → update ticket → insert history), et l'UPDATE ne vérifie ni le statut ni l'assigné courant. Deux auto-assignations simultanées passent toutes deux `checkCanAssign` → deux lignes `ticket_assignments`, last-write-wins. Une panne entre l'insert et l'update laisse un ticket non assigné avec un historique d'assignation.
- **Impact** : perte de données, double assignation, incohérence post-incident — contraste avec `changeStatus` qui, lui, a un verrou optimiste correct (`:296-301`).
- **Correctif** : `runInTransaction` + pattern de claim atomique (`returning` + retry/conflict) comme `SlaAutoCloseService.process()`.

### P1-7. BullBoard : identifiants par défaut connus en production
- **Fichier:ligne(s)** : `src/common/bull-board/bull-board.module.ts:22-46` (middleware), `:29-30` (défauts), `:86-90` (montage)
- **Catégorie** : sécurité
- **Détail** : `process.env['BULLBOARD_USER'] || 'admin'` / `'bullboard'` — aucun crash ni warning si absents. Comparaison en clair (pas de `timingSafeEqual`). Le panneau donne accès à 7 files : rejeu, suppression, lecture des payloads de jobs (données métier).
- **Impact** : prise de contrôle opérationnelle des files (emails, rapports, livraisons) par tout attaquant connaissant les défauts.
- **Correctif** : throw au démarrage si non définis en production (comme `JwtConfigService.getSecret`), `timingSafeEqual`, restriction réseau Nginx.

### P1-8. `/metrics` public, non throttlé
- **Fichier:ligne(s)** : `src/common/metrics/metrics.controller.ts:25, 34-35`
- **Catégorie** : sécurité (fuite d'information)
- **Détail** : `@Auth(AuthMode.ANONYMOUS)` + `@SkipThrottle` sur `GET /metrics`. La protection ne peut venir que d'une règle Nginx (non vérifiable dans le code).
- **Impact** : volumétrie, routes appelées, latences, métriques process exposées publiquement → aide au ciblage, surface de scraping.
- **Correctif** : token Bearer dédié au scraping (ou mTLS/IP allowlist Nginx), garde séparé du JWT utilisateur.

### P1-9. Queue email sans retry : emails perdus sur panne SMTP transitoire
- **Fichier:ligne(s)** : `src/queues/queues.module.ts:56` (queue email sans `defaultJobOptions`) ; `src/queues/workers/email.worker.ts:66` (log « retry=3 » faux) ; appelants `users.service.ts:461-471`, `report.worker.ts:143-145`
- **Catégorie** : logique / fiabilité
- **Détail** : BullMQ applique `attempts: 1` par défaut. Le log du worker annonce 3 retries qui n'existent pas. Le fallback template (email.worker.ts:46-53) ne couvre que les erreurs de rendu, pas SMTP.
- **Impact** : emails transactionnels (bienvenue, alertes SLA, liens de rapports) silencieusement perdus.
- **Correctif** : `defaultJobOptions: { attempts: 3, backoff: exponential }` sur la queue email + corriger le log.

### P1-10. Secret HMAC des liens signés en dur, actif hors production
- **Fichier:ligne(s)** : `src/modules/reports/report-download-link.service.ts:16-17, 78-84`
- **Catégorie** : sécurité
- **Détail** : `DEVELOPMENT_SECRET = 'development-report-download-secret-change-me'` utilisé dès que `NODE_ENV !== 'production'`. Or `NODE_ENV` défaut à `development` (`email.service.ts:47`). Le lien n'est lié ni au demandeur ni à un usage unique, TTL 7 jours.
- **Impact** : si un déploiement omet `NODE_ENV=production` ou la variable, **tous les liens de téléchargement de rapports sont forgeables** (données sensibles : tickets, SLA, hebdo).
- **Correctif** : gating fatal au démarrage dans tous les environnements, suppression du fallback en dur, TTL borné (24-48 h).

### P1-11. `DELIVERY_UNKNOWN` : état terminal sans rejeu ni alerte
- **Fichier:ligne(s)** : `src/modules/external-delivery/services/external-delivery.service.ts:81` (early return), `:84-108` (passage en DELIVERY_UNKNOWN), `:44-75` (`requeueFailedDeliveries` ne sélectionne jamais DELIVERY_UNKNOWN) ; `external-deliveries.admin.controller.ts:17-43` (aucun endpoint de rejeu)
- **Catégorie** : logique / fiabilité
- **Détail** : quand un worker meurt après acceptation du provider (résultat ambigu), la livraison passe en `DELIVERY_UNKNOWN` et n'est **jamais re-sélectionnée** — ni par le rejeu périodique, ni par l'API admin, ni par l'outbox (déjà PUBLISHED).
- **Impact** : email ni confirmé ni rejoué, sans alerte ; perte silencieuse ou doublon potentiel.
- **Correctif** : inclure DELIVERY_UNKNOWN dans le rejeu (délai long), exposer `POST /:id/retry`, dédup par `providerMessageId`.

### P1-12. Budget IA du bot contournable par concurrence (check-then-act)
- **Fichier:ligne(s)** : `src/modules/support-bot/services/support-bot.service.ts:51-52, 122, 172-186`
- **Catégorie** : concurrence
- **Détail** : `countTodayBotCalls()` (compte les messages OUTBOUND persistés) est comparé au budget **avant** l'appel LLM, mais le message n'est inséré qu'**après** la réponse. Deux requêtes concurrentes passent toutes deux le test ; les appels en vol ne comptent pas.
- **Impact** : quota quotidien contournable par parallélisme → coût fournisseur IA non borné (le throttler 1000 req/15 min par IP ne borne pas la concurrence multi-IP).
- **Correctif** : compteur atomique Redis (`INCR` + `EXPIRE`, fail-closed) **avant** l'appel provider, ou verrou distribué par intégration.

---

## 3. Constats détaillés — P2 (sélection commentée)

### 3.1 Domaine ticket / SLA / dashboard

| # | Finding | Fichier:ligne | Détail / Impact |
|---|---------|---------------|-----------------|
| P2-1 | SLA première réponse non « pause-aware » | `sla-alert-processor.service.ts:108-112` ; `tickets.service.ts:536-549` | FIRST_RESPONSE ne filtre pas `slaPausedAt` (RESOLUTION le fait) et `firstResponseDueAt` n'est jamais étendu au resume → fausses violations pendant l'attente client |
| P2-2 | Durée de pause perdue sur `PENDING_* → RESOLVED` | `tickets.service.ts:552-554` | `accumulatedPauseMs` jamais cumulée sur cette transition autorisée → donnée de pause fausse dans l'API |
| P2-3 | `update()` sans recalcul SLA sur changement category/priority | `tickets.service.ts:242-271` | Politique figée à la création ; un LOW→CRITICAL garde ses échéances LOW → engagement SLA contractuellement faux |
| P2-4 | Rallonge SLA de réouverture codée en dur (+240 min BUSINESS_HOURS) | `tickets.service.ts:567-574` | Ignore la politique du ticket et son `calendarType` (CRITICAL = 24_7) ; `firstResponseDueAt` non recalculé |
| P2-5 | Cache Redis dashboard annoncé dans AGENTS.md mais absent du code | `dashboard.service.ts` (730 l.), `dashboard-sla.service.ts`, `public-support-stats.service.ts` | 7 endpoints ré-agrègent tickets/audit_logs à chaque appel ; la doc promet un cache 60 s qui n'existe pas |
| P2-6 | KPI dashboard incohérents | `dashboard.service.ts:94-136, 154-175, 192-200` | `complianceRate` = tickets ouverts conformes / **tous** tickets ; `avgAgeMinutes` inclut les clos ; `atRisk` double-compte les overdue ; requête CRITICAL exécutée puis jetée (`[]` L98) |
| P2-7 | `FieldProjectionInterceptor` vide la réponse dashboard | `dashboard.controller.ts:36`, `field-projection.interceptor.ts:38-47` | `?detail=summary` → `{}` silencieux (resource 'dashboard' absente de SUMMARY_FIELDS) |
| P2-8 | `sla.helper.ts` : plage d'heures ouvrées non validée | `sla.helper.ts:38-42, 78-98` | cf. P1-7 ; source de vérité hybride `process.env` vs table `settings` → divergence entre config éditée et calcul effectif |
| P2-9 | Écart matrice RBAC : assigné peut clore, créateur CS peut rouvrir | `ticket-permissions.ts:181-191, 196-218` | AGENTS.md réserve Close/Reopen à SUPERVISOR/ADMIN ; le code est plus permissif — la matrice (ou le code) doit être mis à jour, avec test de conformité |
| P2-10 | `DepartmentsService.update` sans contrôle d'unicité du nom | `departments.service.ts:104-130` | 500 au lieu de 409 (ou doublon) ; pattern existe pourtant dans `categories.service.ts:94-104` |
| P2-11 | Email de création : catégorie toujours vide | `ticket-notification.listener.ts:173, 195-203` | `event.ticket['category']` n'existe pas (le service expose `categoryName`) → template sans catégorie |
| P2-12 | Code mort SLA/historique | `sla-policies.service.ts:132-144`, `sla-engine.service.ts:50-58`, `ticket-history.service.ts:38-47` | `findByCategoryAndPriority` jamais appelé (lookup inline dans `createFromCommand`), `calculateDueDate` et `record` orphelins → deux sources de vérité potentielles |

### 3.2 Utilisateurs / auth / notifications / audit

| # | Finding | Fichier:ligne | Détail / Impact |
|---|---------|---------------|-----------------|
| P2-13 | `findOne`/`findOneDetailed` sans cloisonnement département (IDOR inter-département) | `users.service.ts:106-188`, `users.controller.ts:104-131` | SUPERVISOR peut lire email/congés/disponibilité de n'importe quel département (le `findAll` applique le scope, pas le `findOne`) |
| P2-14 | `keycloak_subject_id` sans index ni contrainte unique | `users.ts:34`, migration `0019` ; `jwt.strategy.ts:160-174` | Seq scan à **chaque** requête authentifiée (hot path n°1) ; doublons possibles → `limit(1)` arbitraire, binding écrasé |
| P2-15 | WebSocket `/ws` : `verifyAsync` HS256-only — jetons Keycloak RS256 rejetés | `websocket-auth.service.ts:44` ; `auth.module.ts:30-36` | Si le cookie du BFF porte un jeton Keycloak, le temps réel interne est inopérant (« à vérifier » selon le BFF) ; factoriser la validation HTTP/WS |
| P2-16 | Blacklist JWT en fail-open par défaut | `jwt.strategy.ts:238-240` | Redis down → jetons révoqués acceptés ; basculer fail-closed en prod avec alerte |
| P2-17 | DB puis Keycloak sans transaction ni compensation (rôle/activation) | `users.service.ts:329-337, 358-363, 382-387` | État DB modifié mais realm Keycloak inchangé → divergences silencieuses (claim de rôle obsolète, compte désactivé impossible à loguer) |
| P2-18 | `GET /audit-logs` : filtres sans DTO → 500 sur entrées malformées | `audit-logs.controller.ts:68-82`, `audit-logs.service.ts:117-118` | `?from=abc` ou `?userId=pas-un-uuid` → erreur PostgreSQL 22P02 → 500 (le ValidationPipe ne valide pas un type TS inline) |
| P2-19 | `GET /notifications/unread` sans limite | `notifications.service.ts:63-69` | Réponse illimitée pour les utilisateurs à forte volumétrie |
| P2-20 | Pas de garde anti lock-out (auto-désactivation, dernier ADMIN) | `users.service.ts:351-391` | Un ADMIN peut se désactiver ou désactiver le dernier ADMIN actif → lock-out volontaire/accidentel |
| P2-21 | Settings : valeurs non validées à l'écriture | `settings.service.ts:62-87, 99-126` | `BUSINESS_HOURS_START='99'` accepté, lecture retombe silencieusement sur les defaults → régression SLA silencieuse |
| P2-22 | Handlers de révocation WS jamais déclenchés (code mort) | `websocket.gateway.ts:157-165` | Aucun émetteur `auth.session.revoked` dans le code → sockets restent connectés après logout |

### 3.3 Attachments / email / reports / outbox / files

| # | Finding | Fichier:ligne | Détail / Impact |
|---|---------|---------------|-----------------|
| P2-23 | Uploads internes jamais scannés, MIME déclaré client servi | `attachments.service.ts:51, 83, 85` ; `attachment-upload.config.ts:39-42` ; queue attachment-scan déclenchée seulement pour les uploads publics (`outbox-publisher.service.ts:29-34`) | Le pipeline ClamAV/file-type n'est appliqué qu'au public ; un agent interne dépose un polyglotte servi avec Content-Type déclaré (nosniff atténue) |
| P2-24 | `LocalStorageService.validatePath` : préfixe sans séparateur (bypass latent) | `local-storage.service.ts:39-52` ; contournement par le contrôleur `attachments.controller.ts:142` (`join` brut hors `validatePath`) | `../uploads-evil/x` passe le `startsWith` ; non exploitable aujourd'hui (clés générées serveur) mais faille latente — corriger préventivement |
| P2-25 | Jobs audit/notification conservés indéfiniment dans Redis (payloads sensibles) | `audit.worker.ts:54-56`, `notification.worker.ts:62-63` | `removeOnComplete: { count: 1000 }` sans limite d'âge → valeurs d'audit et notifications en clair dans Redis ; basculer sur `{ age: 3600 }` |
| P2-26 | Outbox en échec définitif jamais rejoué ; tables jamais purgées | `outbox.service.ts:59-77` ; aucun `delete(outboxEvents)`/`delete(externalDeliveries)` dans `src/` | `FAILED` terminal sans alerte ; `PUBLISHED`/`DELIVERED` s'accumulent sans fin |
| P2-27 | ReportWorker : catch-all neutralise les retries BullMQ (attempts=3 jamais utilisés) | `report.worker.ts:204-231, 307-339, 423-450` | Toute erreur (même transitoire) → `updateReportStatus('failed')` définitif ; relancer l'erreur et ne marquer failed qu'à la dernière tentative |
| P2-28 | Queues notification/sla/audit/assignment sans `attempts` | `queues.module.ts:56-60, 66-70` | Une erreur DB transitoire = notification/audit/assignation perdus (l'audit est censé être immuable) |
| P2-29 | OTP envoyé par SMTP synchrone dans le chemin de requête | `email-contact-verification.provider.ts:9-13`, `contact-verification.service.ts:94-106` | Latence HTTP variable ; échec SMTP = promesse non gérée (unhandled rejection) et OTP jamais délivré — passer par `queues.email.add` |
| P2-30 | Listener satisfaction : insert outbox sans try/catch | `ticket-satisfaction.listener.ts:45-59` | Échec DB → unhandled rejection ; au prochain close/reopen le token existe déjà → `ConflictException` → lien jamais envoyé |

### 3.4 Portail public / multi-tenant / websocket

| # | Finding | Fichier:ligne | Détail / Impact |
|---|---------|---------------|-----------------|
| P2-31 | Satisfaction « usage unique » : check-then-act non atomique | `support-satisfaction.service.ts:58-70` | UPDATE sans `AND consumedAt IS NULL` → double soumission par course (double-clic/retry) écrase la note ; pattern `returning` à appliquer |
| P2-32 | Challenges OTP `PENDING` jamais purgés (PII conservée) | `retention-cleanup.service.ts:80-89` | La purge ne cible que EXPIRED/LOCKED ; un challenge abandonné reste PENDING à vie avec `encryptedDestination` déchiffrable |
| P2-33 | Quotas OTP par IP spoofables si le port NestJS est joignable sans nginx | `main.ts:50` (`trust proxy 1`), `external-identity.controller.ts:172-174` | `request.ip` = dernière entrée XFF ; si l'app est exposée directement, l'attaquant fixe XFF → quotas par IP neutralisés (« à vérifier » selon le déploiement réseau) |
| P2-34 | Circuit breaker du bot en mémoire par instance | `support-bot.service.ts:28, 62-73, 86, 188-206` | En multi-nœuds, chaque instance a son compteur → protection ineffective pendant une panne provider ; état partagé Redis à prévoir |
| P2-35 | Anonymisation partielle : contenu des tickets ré-identifiable | `external-requesters-admin.service.ts:277-338` | tickets.description/customerName, commentaires, history.newValue non traités → l'« anonymisation » ne résiste pas à une analyse croisée ; documenter le périmètre |
| P2-36 | Bot : résultats des outils jamais renvoyés au modèle | `support-bot.service.ts:105-131` | `reply` figé avant exécution des toolCalls ; le bot affirme avoir enregistré un brouillon même en cas d'échec ; `tool-policy.service.ts:59` force `'OPEN'` au lieu de `conversation.status` |
| P2-37 | Purge `idempotency_records` à chaque requête idempotente | `idempotency.interceptor.ts:89` | DELETE + scan de la table sur chaque mutation (chemin public) → contention ; cron de purge dédié |
| P2-38 | Vue matérialisée créée dans le seed, pas en migration | `run-seed.ts:1087-1110` ; `auto-assignment.cron.ts:57-73` | Re-seed → vue stale (jusqu'à 2 min) ; schéma hors catalogue de migrations |
| P2-39 | Config Redis dupliquée (une est du code mort) | `src/config/redis.config.ts` vs `src/common/providers/redis.config.ts` | `RedisConfigService` non référencé ; tous les consommateurs utilisent l'objet `redisConfig` — supprimer la classe et la note `index.ts:14-15` |
| P2-40 | Clients Redis Pub/Sub de l'adapter WS sans gestion d'erreur | `redis-io.adapter.ts:36-50` | ioredis émet `'error'` non géré → **crash du process si Redis tombe** (contraire au design fail-open du reste) ; ajouter listeners + retryStrategy + close au shutdown |
| P2-41 | Stratégie JWT : pas d'`issuer`/`audience` sur les jetons HS256 ; choix d'alg sur header non vérifié | `jwt.strategy.ts:48-75` | Tout jeton HS256 signé avec `accessSecret` accepté quel que soit l'émetteur ; l'anti-confusion est correct (clés distinctes) mais le commentaire « Allowlist stricte » est exagéré |
| P2-42 | Fallback mot de passe DB en clair sans garde de production | `database.config.ts:48-50`, `run-seed.ts:22-23` | `'telecom_secret'` accepté en production si la variable manque — étendre la garde `getSecret` du JWT à la config DB |
| P2-43 | Recherche tickets `ILIKE '%…%'` sans index trigram | `tickets-search.service.ts:139-151` | 6 `ilike('%term%')` → seq scan sur la table la plus grosse ; extension `pg_trgm` + GIN |
| P2-44 | OTel : export 100 % des traces, sans sampler ni auth | `observability/otel.ts:28-61` | `ParentBased(AlwaysOn)` par défaut ; coût réseau/Tempo maximal ; sampler `TraceIdRatioBased(0.1)` configurable |
| P2-45 | **N+1 sur la diffusion des notifications** (remonté du rapport 1600 — HIGH) | `ticket-notification.listener.ts:65-86, 100-133` | `getUserInfo()`/`getUserEmail()`/`getTicketEmailContext()` exécutés individuellement par destinataire → dizaines de requêtes unitaires identiques par événement (création/assignation) ; batch `inArray(users.id, recipientIds)` + contexte ticket pré-chargé une seule fois |

---

## 4. Constats P3 (dette, regroupés)

### 4.1 Sécurité / hygiène
- **P3-a** Mot de passe temporaire renvoyé en clair dans la réponse `create()` — `users.service.ts:283` (documenté « une seule fois », mais traîne dans les outils de dev) → lien de première connexion à usage unique.
- **P3-b** Secrets de dev par défaut : `jwt.config.ts:26-36` — la garde 32 caractères ne s'active que si `NODE_ENV === 'production'` ; échouer au boot si `NODE_ENV` absent.
- **P3-c** WebSocket : aucune limite de connexions par utilisateur (`websocket.gateway.ts:75-108`) ; idem gateway public (`public-support.gateway.ts:27-57` — jusqu'à 100 rooms/connexion, 2 requêtes DB par handshake).
- **P3-d** `GET /auth/me` renvoie `jti`/`sessionIssuedAt` inutiles côté client (`auth.controller.ts:30-32`).
- **P3-e** PII loggée : emails utilisateur dans `users.service.ts:265, 476` et `websocket.gateway.ts:95`.
- **P3-f** `redactSignature` ne masque que `signature` (`request-logger.middleware.ts:38-42`) ; un `token`/`code`/`otp` en query serait journalisé.
- **P3-g** Download interne des pièces jointes sans `Cache-Control: private, no-store` (`attachments.controller.ts:139-162`), contrairement au download public.
- **P3-h** `markAsRead` : ownership vérifié au SELECT puis UPDATE par id seul (TOCTOU) — `notifications.service.ts:111-117`.
- **P3-i** `internalFirstName` des agents exposé au demandeur public (`public-timeline.service.ts:28-31, 68-72`) — le fallback « Équipe support » suggère que l'anonymat était l'intention.
- **P3-j** Header `X-Correlation-Id` non borné ni assaini (`correlation-id.middleware.ts:33`).
- **P3-k** `ToolPolicyService` : `authorize(call.name, 'OPEN')` codé en dur (`tool-policy.service.ts:59`).

### 4.2 Redondance / DRY
- **P3-l** `VALID_ROLES` dupliqué (`create-user.dto.ts:18-26`, `update-user.dto.ts:17-25`) ; `WorkloadWeightsDto` dupliqué (create/update department) ; `requirePublicPrincipal` dupliqué mot pour mot (`public-request.ts:9-13`, `external-identity.controller.ts:176-179`).
- **P3-m** Doubles contraintes uniques : `users.email` (`.unique()` + `uniqueIndex`) et `tickets.ticket_number` (`.unique()` + index) → deux index B-tree identiques sur les tables les plus chaudes.
- **P3-n** Index redondants : `idxNotificationsUser` préfixe de `idxNotificationsUnread` ; `idx_knowledge_versions_article` duplique `versionUnique` ; l'inbox trie par `createdAt` sans index.
- **P3-o** Trois mécanismes de pagination (`pagination.helper.ts`, `normalized-pagination.helper.ts`, `pagination.dto.ts`) ; `publicStatusEventType` dupliquée (`tickets.service.ts:35-42`).
- **P3-p** `LocalStorageService.getUrl` : code mort renvoyant un chemin de route inexistant (`local-storage.service.ts:176-178`).
- **P3-q** `getUserEmail` appelle `getUserInfo` (double requête quand un seul SELECT suffit) ; N+1 sur la diffusion de notifications (`ticket-notification.listener.ts:65-86, 100-133`) — batch avec `inArray` à prévoir.
- **P3-r** `KeycloakAdminService.adminToken()` appelé à chaque opération (4 logins master par `create()`) — `keycloak-admin.service.ts:41-53` ; cache avec TTL.
- **P3-s** `SettingsModule` re-déclare `DrizzleProvider` (déjà @Global) → possible second pool de connexions (« à vérifier » au runtime).
- **P3-t** Loggers instanciés jamais utilisés (`comments.service.ts:38`, `internal-notes.service.ts:28`).

### 4.3 Logique mineure / API
- **P3-u** Types de notification incohérents : `TICKET_RESOLVED` pour une clôture, `COMMENT_ADDED` pour une réouverture (`ticket-notification.listener.ts:370, 422`).
- **P3-v** `firstResponseComplianceRate` = 100 % quand aucun compteur (`dashboard.service.ts:499-502, 612-615`) → null/N-A.
- **P3-w** `SettingsService.getBusinessHours` : `parseInt('0') || 8` interdit 0 h (`settings.service.ts:103-106, 112-115`).
- **P3-x** `ticket-number.service.ts:37` : `result[0]?.nextval || 1` (préférer `??`).
- **P3-y** Branche morte dans l'auto-assignation (`auto-assignment.cron.ts:240` — NEW déjà exclu par la requête) ; `getMaxConcurrentTickets()` appelé dans la boucle (`assignment-engine.service.ts:163`).
- **P3-z** `requeueFailedDeliveries` sans `jobId` unique → jobs no-op accumulés (`external-delivery.service.ts:70`).
- **P3-aa** `updateReportStatus` pose `completedAt` aussi sur `failed` (`reports.service.ts:471-486`).
- **P3-ab** `sendTemplate` : `...data` écrase `appName`/`appUrl`/`footerText` système (`email.service.ts:136-149`).
- **P3-ac** `getUserEmail`/`getTicketEmailContext` avalent toutes les erreurs sans log (`report.worker.ts:100-111`).
- **P3-ad** Wildcards LIKE non échappés (`%`, `_`) dans les recherches (`public-knowledge.service.ts:28-31`, `support-knowledge.service.ts:52-56`, `external-requesters-admin.service.ts:40`).
- **P3-ae** Recherche knowledge : renvoie le `content` complet dans les résultats (`public-knowledge.service.ts:33-47`).
- **P3-af** `enveloppe manuelle` incohérente dans SettingsController (`{ success, data }` sans `statusCode`) + double validation JWT (`@UseGuards(JwtAuthGuard, RolesGuard)` alors que le guard global le fait déjà) — `settings.controller.ts:25, 39, 54`.

### 4.4 Qualité / dette structurelle
- **P3-am** Assainir la propriété `details` du `GlobalExceptionFilter` (ajouté du rapport 1600 — LOW) : `global-exception.filter.ts:49-54` passe tel quel `resp['errors'] ?? resp['details']` ; aucun `details: stack` n'existe aujourd'hui dans le code (grep vérifié), mais une future exception avec `details` technique (nom de table SQL, stack) serait exposée au client — borner à des structures connues et filtrer les stack traces en production.
- **P3-ag** 22 fichiers dépassent la règle repo de 200 lignes (comptés le 14/08/2026) : `run-seed.ts` (1141), `dashboard.service.ts` (730), `tickets.service.ts` (683), `ticket-notification.listener.ts` (539), `reports.service.ts` (502), `users.service.ts` (483), `external-requesters-admin.service.ts` (468), `report.worker.ts` (453), `tickets.controller.ts` (411), `assignment-engine.service.ts` (327), `auto-assignment.cron.ts` (325), `sla-alert-processor.service.ts` (313), `dashboard.controller.ts` (269), `external-delivery.service.ts` (268), `ticket-permissions.ts` (267), `support-bot.service.ts` (261), `jwt.strategy.ts` (258), `reports.controller.ts` (256), `support-knowledge.service.ts` (249), `users.controller.ts` (225), `comments.service.ts` (222), `sla-alert-notifier.service.ts` (201).
- **P3-ah** Cron hebdomadaire reports sans verrou distribué → doublons en multi-instance (`report-scheduler.service.ts:46-79`) ; `AuditWorker` sans `OnModuleDestroy` (`audit.worker.ts:12`).
- **P3-ai** Drift OpenAPI/TS : l'interface `ApiResponse` n'a pas `statusCode` alors que l'OpenAPI l'exige (`openapi.schemas.ts:36` vs `api-response.interface.ts:16-20`) ; `TransformInterceptor` laisse passer tout objet contenant `success` sans normalisation.
- **P3-aj** BullBoard : `forRoutes('/admin/queues')` vs `basePath = /api/v1/admin/queues` — routage potentiellement incohérent (« à vérifier » au runtime).
- **P3-ak** `RedisConfigService` : `catch {}` silencieux, getters re-parsent l'env à chaque appel ; `masterKeys` re-décodé à chaque lecture ; `RedisProvider` sans `OnModuleDestroy` ; health check ouvre une connexion Redis éphémère à chaque check (`health.service.ts:53-61`) ; `token-cleanup.service.ts:48-57` matérialise tous les IDs en mémoire.
- **P3-al** Couverture tests `users.service.spec.ts` insuffisante sur les chemins sensibles (5 `it` seulement ; les 2 P1 users ne sont pas détectés par la CI).

---

## 5. Points forts vérifiés (à créditer)

- **Cloisonnement multi-tenant exemplaire** : chaque contrôleur public dérive `supportIntegrationId`/`externalRequesterId` exclusivement de `request.user` (jamais du body/query) ; `PublicTicketAccessService` filtre par requester **et** intégration ; FK composites `(id, support_integration_id)` + triggers de garde en migration 0008.
- **Outbox pattern réellement transactionnel** : écrit dans `runInTransaction` avec `deduplicationKey` unique (6 call sites vérifiés), claim `FOR UPDATE SKIP LOCKED` + lease 60 s, dédup par `jobId: event.id`.
- **Crypto soignée** : OTP haché HMAC avec secret dédié, destinations AES-256-GCM avec AAD contextuel et clés versionnées, jetons opaques 256 bits hachés, nonces Redis `SET NX`, liens signés HMAC-SHA256 avec `timingSafeEqual` + contrôle de longueur, zéro `{{{ }}}` Handlebars (échappement HTML).
- **Uploads publics remarquables** : file-type sur magic bytes réels, ClamAV INSTREAM par chunks 64 Ko avec timeout, quarantaine/promote/cleanup, idempotence par fingerprint du contenu réel.
- **Guards globaux fail-safe** : `RequestAuthGuard` défaut INTERNAL, `whitelist` + `forbidNonWhitelisted` partout, verrou optimiste correct sur `changeStatus`, claim atomique dans `SlaAutoCloseService`/`SlaAlertProcessorService`.
- **Qualité TypeScript** : zéro `any`/`@ts-ignore`/non-null assertion en production ; `uuidv7` via le paquet `uuid` (tri chronologique sûr) ; normalisation des routes Prometheus (pas d'explosion de cardinalité) ; init OTel avant tout import Nest avec gate `OTEL_ENABLED`.
- **Fiabilité des migrations** : snapshots + invariants + détection de schéma partiellement migré (`migration-baseline.validator.ts`) — rare et bien fait.

---

## 6. Recoupement avec le rapport `review-260814-1600-backend-code-review.md`

Le rapport du second agent (3 CRITICAL / 4 HIGH / 6 MEDIUM / 5 LOW) a été comparé finding par finding au présent rapport. Résultat : **10 des 12 findings sont déjà couverts** (avec fichiers:lignes identiques ou plus précis). Deux points ont nécessité arbitrage après vérification manuelle du code :

| Finding rapport 1600 | Gravité 1600 | Statut ici | Justification de l'arbitrage (vérifié dans le code) |
|----------------------|--------------|------------|---------------------------------------------------|
| `jwt.strategy.ts:85-88` — isRevoked contourné pour Keycloak | CRITICAL | ✅ P1-1 (identique) | Confirmé ligne à ligne ; conservé P1 car non exploitable sans révocation effective en amont, mais priorité absolue |
| `jwt.strategy.ts:180-184` — email_verified fail-open | CRITICAL | ✅ P1-2 (identique) | Confirmé |
| `support-bot.service.ts:107-116` — tool loop incomplète | CRITICAL | ✅ P2-36 (identique) | Confirmé ; P2 car bug fonctionnel (pas d'exploitation directe) |
| `tool-policy.service.ts:59` — `'OPEN'` codé en dur | CRITICAL | ⬇️ **P3-k (déclassé)** | **Vérifié** : `support-bot.service.ts:20-21` rejette déjà toute conversation non-OPEN (`ConflictException`) avant exécution des outils ; le point reste un défaut de défense en profondeur (tout futur appelant de `tools.execute()` serait exposé) → à corriger mais non exploitable dans le flux actuel |
| `idempotency.interceptor.ts:89` — DELETE à chaque requête | HIGH | ✅ P2-37 (identique) | Confirmé |
| `tickets.service.ts:242-264, 360-390, 420-445` — non-atomicité | HIGH | ✅ P1-6 (identique) | Confirmé |
| `ticket-notification.listener.ts:53-80, 110-140` — N+1 | HIGH | ✅ **P2-45 (remonté)** | Confirmé ; remonté de P3 à P2 (impact réel sur diffusions multi-destinataires) |
| 21 fichiers > 200 lignes | MEDIUM | ✅ P3-ag (identique) | Comptage rafraîchi : 22 fichiers (wc -l réel, lignes mises à jour) |
| pagination.helper vs normalized-pagination.helper | MEDIUM | ✅ P3-o (identique) | Confirmé (3 mécanismes en réalité) |
| `dashboard.service.ts:80-130` — agrégations non cachées | MEDIUM | ✅ P2-5/P2-6 (identiques) | Confirmé ; cache absent du code malgré AGENTS.md |
| `tickets.service.ts:35-42` — publicStatusEventType dupliquée | LOW | ✅ P3-o (identique) | Confirmé |
| GlobalExceptionFilter — details techniques | LOW | ✅ **P3-am (ajouté)** | Aucun `details: stack` dans le code actuel (grep) ; mesure défensive à ajouter |

**Bilan du recoupement** : aucun P0 confirmé ni par l'autre agent ni ici ; les 3 « CRITICAL » de l'autre rapport sont 2 P1 (sécurité, priorité absolue) et 1 P2 (bug fonctionnel bot) ; le seul déclassement majeur (tool-policy, CRITICAL → P3) est justifié par le garde-fou existant en amont. Le plan d'implémentation couvre l'union des deux rapports.

---

## 7. Écarts documentation ↔ code (à résorber)

| Écart | Doc (AGENTS.md) | Code réel |
|-------|-----------------|-----------|
| Cache dashboard | « Cache-Aside Redis 60 s TTL » | Aucun cache — 7 endpoints ré-agrègent à chaque appel |
| Matrice RBAC | Close/Reopen = SUPERVISOR/ADMIN | L'assigné peut clore, le créateur CS peut rouvrir |
| 24 politiques SLA | « 24 policies » | Lookup inline dans `createFromCommand`, `findByCategoryAndPriority` mort |
| Revocation Keycloak | Logout/blacklist documentés | `isRevoked` contourné pour les jetons Keycloak ; aucun émetteur d'événements de révocation |
| 8 workers « retry » | Fiabilité production | 5 queues sans `attempts`, worker reports neutralise ses retries, log « retry=3 » faux |

---

## 8. Plan d'action priorisé

### Phase 1 — Sécurité immédiate (avant tout déploiement)
1. P1-1 : appliquer `isRevoked` à tous les jetons + câbler les événements de révocation.
2. P1-2 : `email_verified === true` strict.
3. P1-3 : garde rôle cible dans `users.update` + tests.
4. P1-7 : gating BullBoard (throw en prod) + `timingSafeEqual`.
5. P1-8 : authentifier `/metrics` (token scraping) ou IP allowlist Nginx.
6. P1-10 : gating fatal `REPORT_DOWNLOAD_SECRET` + TTL borné.

### Phase 2 — Fiabilité des écritures et des files
7. P1-5/6 : transactions + validation d'état sur `assign`/`escalate`/`update` (+ tests de concurrence).
8. P1-9/P2-28 : `defaultJobOptions` (attempts + backoff) sur email/notification/sla/audit/assignment.
9. P1-11/P2-26 : rejeu des `DELIVERY_UNKNOWN` et des `FAILED` outbox + purge cron (idempotency_records, outbox_events, external_deliveries).
10. P2-27 : laisser BullMQ retrier dans ReportWorker (pattern `finalAttempt`).
11. P2-40 : gestion d'erreur des clients Redis Pub/Sub (crash process).

### Phase 3 — Cohérence métier
12. P2-1/2/3/4 : SLA pause-aware, recalcul sur update, rallonge configurable.
13. P2-5/6 : implémenter le cache dashboard OU corriger AGENTS.md ; corriger les KPI.
14. P1-4 : index unique partiel `WHERE deleted_at IS NULL` (users/departments/categories/tickets).
15. P2-13/14 : cloisonnement findOne + index unique `keycloak_subject_id`.
16. P2-31/32/36 : atomique satisfaction, purge OTP PENDING, boucle outils bot + compteur Redis budget.

### Phase 4 — Dette (au fil de l'eau)
17. Découper les 22 fichiers > 200 lignes (services ticket/dashboard/seed d'abord).
18. Supprimer les doublons (config Redis, VALID_ROLES, pagination, contraintes uniques, index redondants).
19. Uniformiser la validation (DTO audit-logs, settings sémantique, notif limitée).
20. Aligner la doc (AGENTS.md : cache, RBAC, retries) sur la réalité ou l'inverse.

---

## 9. Limites de cette revue

- **Non vérifié au runtime** : routage BullBoard (`forRoutes` vs `basePath`), comportement du BFF (cookie HS256 vs RS256 pour le WS), configuration réseau Nginx (exposition directe du port NestJS), absence/pérennité de la règle réseau sur `/metrics`.
- **Non audité** : `frontend/`, `public-frontend/`, `nginx/`, `docker-compose*.yml` (hors périmètre « backend » demandé).
- Les fichiers `.spec.ts` ont été lus pour comprendre les contrats mais pas audités comme code de production.
- Les migrations SQL ont été inspectées (index, contraintes) sans exécution.

---

## 10. Conclusion

**Verdict : le backend est solide, production-ready sur l'essentiel, mais 12 P1 doivent être traités avant de le considérer « durci ».** Aucun P0 n'a été trouvé : l'architecture, le cloisonnement tenant, la crypto et l'outbox sont d'excellente facture. Les risques restants sont typiques d'un projet arrivé vite en maturité : politique de retry incohérente entre les 8 files, états terminaux sans issue, gardes RBAC incomplètes sur le module users, et une documentation (AGENTS.md) qui a pris un temps d'avance sur le code (cache, RBAC, révocation). La priorité absolue est la Phase 1 (sécurité des jetons et des surfaces d'admin), suivie de la Phase 2 (atomicité et fiabilité des files).

*Rapport généré via le workflow `code-review` (agent `code-reviewer`), consolidé et vérifié ligne à ligne. Aucun fichier n'a été modifié.*
