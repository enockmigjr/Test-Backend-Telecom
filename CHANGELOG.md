# Changelog

Tous les changements notables sont documentés ici. Format basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/).

---

## [1.3.0] — 2026-07-03

### Added

- **Génération de PDF Premium (PDFKit)** : implémentation de méthodes de dessin de documents haut de gamme pour les rapports d'incidents (grilles, résumés) et les rapports SLA (indicateurs graphiques, structures de tableaux).
- **Rapports par E-mail avec lien sécurisé** : modification de `EmailService`, `EmailWorker` et `ReportWorker` pour automatiser l'envoi de rapports sous forme de lien de téléchargement sécurisé expirable au lieu d'une pièce jointe PDF lourde.
- **Templates de Rapports Uniformisés** : ajout des templates Handlebars enfants `ticket-report.hbs` et `sla-report.hbs` s'appuyant tous les deux sur le layout global unifié `base.hbs`.
- **Table de suivi de rapports `reports`** : implémentation d'une table Drizzle autonome `reports` pour persister l'historique et le statut (`pending`, `completed`, `failed`) de chaque demande sans être contraint par les checks de `attachments`.
- **Nouveau type de notification `REPORT_FAILED`** : ajout à l'énumération en base de données.
- **Nouvelles routes REST de rapports** : ajout de la route d'administration paginée `GET /reports` (Admin uniquement) et de la route de téléchargement de fichier `GET /reports/:id/download` (Admin ou demandeur).

### Fixed

- **Robustesse du cycle de vie des rapports** : traitement global try/catch dans `ReportWorker`, retry exponentiel automatique (3 essais), envoi obligatoire d'email et émission WebSocket/in-app pour les succès comme les échecs.
- **Pagination Numérique ORM** : correction du bug de pagination dans les query parameters `page` et `limit` convertis explicitement en `Number` pour Drizzle ORM.
- **Dépendance Circulaire NestJS** : correction de la dépendance circulaire entre `QueuesModule` et `ReportsModule` via l'usage propre de `forwardRef(() => Module)`.
- **Correctif d'importation PDFKit** : correction de l'import PDFKit (`import PDFDocument from 'pdfkit'`).
- **Correction des types dans les tests unitaires** : résolution des alertes de types TypeScript Jest dans `reports.controller.spec.ts` par le biais de casts sur les fonctions mockées.

---

## [1.2.0] — 2026-07-02

### Added

- **Ownership-based RBAC tickets** : refonte complète des permissions tickets — plus de blocage `ADMIN/SUPERVISOR only`. Les agents peuvent désormais agir sur leurs propres tickets (auto-assign, start, resolve, close). Les superviseurs conservent les droits élargis
- **Nouveaux endpoints tickets** :
  - `POST /tickets/:id/reassign` — réassignation par l'assigné actuel, superviseur ou admin
  - `POST /tickets/:id/pending-customer` — mise en attente client (IN_PROGRESS → PENDING_CUSTOMER)
  - `POST /tickets/:id/pending-third-party` — mise en attente tiers (IN_PROGRESS → PENDING_THIRD_PARTY)
- **Auto-clôture après 48h** : `SlaEngineService` clôture automatiquement les tickets `RESOLVED` depuis plus de 48h (cron `/\*5 min`)
- **Swagger enrichi** : `@ApiBody`, `@ApiResponse` (200/201/204/400/403/404) et `@ApiQuery` complets sur tous les endpoints tickets (13 filtres sur `GET /tickets`)
- **Suite E2E complète** : 102 tests E2E passants (14 suites) dont `tickets-permissions.e2e-spec.ts`, `rbac.e2e-spec.ts`, `comments.e2e-spec.ts`, `internal-notes.e2e-spec.ts`, `notifications.e2e-spec.ts`, `sla-policies.e2e-spec.ts`, `reports.e2e-spec.ts`, `audit-logs.e2e-spec.ts`, `dashboard.e2e-spec.ts`, `health.e2e-spec.ts`, `departments.e2e-spec.ts`, `users.e2e-spec.ts`
- **Nouveaux DTOs** : `ResolveTicketDto` (resolutionSummary optionnel), `ReopenTicketDto` (reason obligatoire ≥ 10 car.), `PendingTicketDto` (reason optionnel)
- **WebSocket** : nouveaux événements `ticket.closed` et `ticket.reopened` émis par le listener
- **`GET /sla-policies/:id`** : route de détail d'une politique SLA ajoutée (manquante)

### Fixed

- **tickets.controller.ts** : restauration de tous les décorateurs Swagger (`@ApiBody`, `@ApiResponse`, `@ApiQuery` complets) supprimés lors de la refonte
- **docs/routes.md** : correction des rôles tickets (ownership-based), ajout des 4 nouvelles routes (total 52), correction departments (bearer auth, non public), ajout `GET /sla-policies/:id`
- **tests E2E** : `users.e2e-spec.ts` → assertion pagination corrigée (`data.data`), `departments.e2e-spec.ts` → nom dynamique pour éviter les 409, `tickets-permissions.e2e-spec.ts` → sélection utilisateurs par email

---

## [1.1.0] — 2026-07-01

### Added

- **Swagger professionnel** sur 5 modules : `comments`, `internal-notes`, `notifications`, `dashboard`, `reports` — chaque endpoint a `@ApiOperation`, `@ApiResponse`, `@ApiParam`, `@ApiQuery`, `@ApiBody`, rôles documentés
- **DTOs manquants** : `CreateInternalNoteDto`, `UpdateInternalNoteDto`
- **Email de bienvenue** : `UsersService.create()` envoie le mot de passe temporaire via `EMAIL_QUEUE` → `account-created.hbs`
- **Email confirmation mot de passe** : `AuthService.changePassword()` envoie via `EMAIL_QUEUE` → `password-changed.hbs`
- **Rapport hebdomadaire** : `ReportWorker.generateWeeklyReport()` requête les stats réelles (créés/résolus/ouverts, violations SLA, conformité, temps moyen) → `admin-weekly-report.hbs`
- **Notification + email** pour tous les rapports async (ticket, SLA, hebdomadaire) — le message "Vous recevrez une notification" est maintenant vrai
- **Templates email inline** : `accountCreated`, `passwordChanged`, `adminWeeklyReport` fallback dans `EmailService`
- **5ème worker BullMQ** : `ReportWorker` avec notification + email intégrés
- **Variables d'environnement** sur tous les fichiers : `${VAR:-default}` pour chaque URL, host, port, credential
- **Tests exhaustifs** : 446 tests unitaires (31 suites) + 43 E2E + 10 intégration = **499 tests**, couvrant tous les modules
- **REPORT_READY** : nouveau type de notification dans `notification_type_enum` pour les rapports générés en arrière-plan (BullMQ → REPORT_READY) avec WebSocket émis vers le demandeur
- **BullBoard** : interface de supervision des 5 queues BullMQ à `/admin/queues`, protégée par Basic Auth en production
- **Token Cleanup** : cron quotidien à 3h — nettoie `refresh_tokens` expirés + révoqués >30 jours
- **`.env.example`** complet : 70+ variables documentées avec leurs valeurs par défaut
- **`.env`** synchronisé avec `.env.example`
- **`test/jest-integration.json`** : configuration Jest dédiée aux tests d'intégration
- **Commandes npm** : `test:unit`, `test:e2e`, `test:integration`, `test:all`
- **GitHub Actions CI** : 6 jobs fonctionnels (lint, test, build, e2e, security, docker)
- **GitHub Actions CD** : build & push Docker image vers GHCR
- **`CHANGELOG.md`** : ce fichier

### Fixed

- **EmailWorker** : utilise `sendTemplate()` Handlebars, fallback inline si `.hbs` manquant
- **TicketNotificationListener** : `ticket-assigned` et `ticket-escalated` envoient `ticketNumber` + `title` au lieu d'IDs bruts
- **SlaEngineService** : email `sla-breach` inclut le vrai `title` (ajouté au SELECT)
- **ReportWorker** : notification in-app + email envoyés au `requestedBy` (avant : juste un log)
- **Tests E2E** : `createTestApp()` partagé + `flushRedis()` prévient les 429 rate-limit
- **Tests d'intégration** : assertions `data.meta` au lieu de `meta` (TransformInterceptor)
- **Tests unitaires** : `AuthService` et `UsersService` mock `BullMQ_Queues`
- **CI** : `prepare` script corrigé (`husky || true`) pour CI sans husky installé
- **Infrastructure configs** : toutes les URLs, ports, credentials en `${VAR:-default}`
- **docker-compose.yml** : mots de passe PostgreSQL/Grafana, URLs en variables
- **alertmanager.yml** : WhatsApp phone/apiKey protégés par variables

### Security

- Plus aucun secret en dur dans les fichiers de configuration
- CI utilise des valeurs de test (pas de secrets production)
- WhatsApp API key externalisée

---

## [1.0.0] — 2026-06-28

### Added

- **12 modules NestJS** : auth, users, departments, tickets, comments, internal-notes, attachments, notifications, sla, dashboard, audit-logs, email, reports
- **Authentification JWT** : login, refresh rotation SHA-256, logout, logout-all, change-password, Argon2id
- **RBAC 7 rôles** : ADMINISTRATOR, SUPERVISOR, CUSTOMER_SERVICE_AGENT, NOC_ENGINEER, BILLING_AGENT, TECHNICAL_SUPPORT_ENGINEER, FIELD_TECHNICIAN
- **Tickets** : State machine 9 statuts, transitions immuables, numérotation INC-AAAA-NNNNNN, recherche avancée multi-filtres, historique complet
- **Collaboration** : Commentaires publics, notes internes (restriction FIELD_TECHNICIAN), pièces jointes (interface abstraite IStorageService)
- **Notifications** : Inbox pattern, read/unread, mark-all-read
- **Temps réel** : WebSocket Gateway JWT auth, rooms user/department/role, Redis adapter pour scaling horizontal
- **SLA Engine** : Cron \*/5 min, breach/warning detection
- **Dashboard** : 7 endpoints (overview, tickets-by-status, tickets-by-priority, departments, sla-compliance, workload, resolution-time)
- **Audit Logs** : Immutable write-only, recherche multi-filtres
- **Email** : Nodemailer dev (Mailpit) / prod (SMTP), 7 templates Handlebars
- **Rate Limiting** : Redis distribué via ThrottlerStorageRedisService
- **BullMQ** : 5 files + 5 workers (email, notification, SLA, audit, report)
- **Prometheus** : 9 métriques custom + defaults Node.js
- **Observabilité** : OpenTelemetry SDK, Prometheus/Loki/Tempo/Grafana/Promtail, Alertmanager
- **Docker Compose** : 13 services
- **Health Checks** : /health (liveness), /health/ready (DB + Redis)
- **Idempotence** : Middleware Idempotency-Key + cache Redis 24h
- **Field Projection** : Interceptor `?detail=summary|full`
- **Soft Delete** : departments, users, tickets
- **UUID v7** : Toutes les clés primaires
- **CI/CD** : GitHub Actions (lint, test, build, e2e, security, docker)
- **Makefile** : 20 commandes
- **Documentation** : 7 fichiers dans `docs/`, README, CLAUDE.md
- **Tests** : 25 unitaires state machine, 12 E2E auth

### Technical Details

- **Stack** : NestJS 10, PostgreSQL 16, Drizzle ORM 0.33, Redis 7, BullMQ 5, Socket.io 4
- **Tests** : 113 unitaires, 43 E2E, 10 intégration = **166 tests**
- **Build** : TypeScript strict mode, zéro erreur
