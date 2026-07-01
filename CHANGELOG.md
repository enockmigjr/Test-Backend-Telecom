# Changelog

## [1.0.0] — 2026-06-29

### Added

- **12 modules NestJS**: auth, users, departments, tickets, comments, internal-notes, attachments, notifications, sla, dashboard, audit-logs, email
- **Authentification JWT**: login, refresh rotation SHA-256, logout, logout-all, change-password, Argon2id
- **RBAC 7 rôles**: ADMINISTRATOR, SUPERVISOR, CUSTOMER_SERVICE_AGENT, NOC_ENGINEER, BILLING_AGENT, TECHNICAL_SUPPORT_ENGINEER, FIELD_TECHNICIAN
- **Tickets**: State machine 9 statuts, transitions immuables, numérotation INC-AAAA-NNNNNN, recherche avancée multi-filtres, historique complet
- **Collaboration**: Commentaires publics, notes internes (restriction FIELD_TECHNICIAN), pièces jointes (interface abstraite IStorageService)
- **Notifications**: Inbox pattern, read/unread, mark-all-read
- **Temps réel**: WebSocket Gateway JWT auth, rooms user/department/role, Redis adapter pour scaling horizontal
- **SLA Engine**: Cron \*/5 min, breach/warning detection, notInArray
- **Dashboard 7 endpoints**: overview, tickets-by-status, tickets-by-priority, departments, sla-compliance, workload, resolution-time
- **Audit Logs**: Immutable write-only, recherche multi-filtres
- **Email**: Nodemailer avec switch automatique dev (Mailpit) / prod (SMTP), templates HTML intégrés
- **Rate Limiting**: Redis distribué via ThrottlerStorageRedisService
- **BullMQ**: 4 files (email, notification, sla, audit) + 4 workers complets
- **Prometheus**: 9 métriques custom + defaults Node.js, endpoint /metrics OpenMetrics
- **Observabilité**: OpenTelemetry SDK (HTTP, Express, NestJS, PostgreSQL, Redis), configs Prometheus/Loki/Tempo/Grafana/Promtail
- **Docker Compose**: 13 services (PostgreSQL, Redis, API, Nginx, Mailpit, Prometheus, Loki, Tempo, Grafana, Promtail, Uptime Kuma, Node Exporter)
- **Health Checks**: /health (liveness), /health/ready (PostgreSQL + Redis ping)
- **Idempotence**: Middleware avec header Idempotency-Key + cache Redis 24h
- **Field Projection**: Interceptor ?detail=summary|full
- **Soft Delete**: departments, users, tickets — aucune suppression physique
- **UUID v7**: Toutes les clés primaires
- **CI/CD**: GitHub Actions (lint, test, build, security, docker)
- **Makefile**: 20 commandes unifiées
- **Documentation**: 7 fichiers docs/ (routes, architecture, deploy, jobs, implementation status)

### Technical Details

- **Stack**: NestJS 10, PostgreSQL 16, Drizzle ORM 0.33, Redis 7, BullMQ 5, Socket.io 4
- **Tests**: 25 tests unitaires state machine, 12 tests E2E auth
- **Build**: TypeScript strict mode, zéro erreur
