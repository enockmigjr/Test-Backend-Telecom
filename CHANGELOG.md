# Changelog

Tous les changements notables sont documentés ici. Format basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/).

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
- **`.env.example`** complet : 60+ variables documentées avec leurs valeurs par défaut
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
