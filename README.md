# 📡 Telecom Ticket Management — Backend API

![NestJS](https://img.shields.io/badge/NestJS-10.4-E0234E?logo=nestjs)
![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?logo=typescript)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql)
![Redis](https://img.shields.io/badge/Redis-7-DC382D?logo=redis)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker)
![Tests](https://img.shields.io/badge/Tests-166%20passed-success)
![License](https://img.shields.io/badge/License-UNLICENSED-lightgrey)

Backend **NestJS** pour la plateforme de gestion des tickets d'incidents télécoms.
Utilisé par le Service Client, NOC, Facturation, Support Technique et Opérations Terrain.

---

## 🚀 Démarrage Rapide

```bash
# Installer
pnpm install

# Lancer PostgreSQL + Redis + Mailpit
docker compose up -d postgres redis mailpit

# Pousser le schéma + seed
pnpm run db:push && pnpm run db:seed

# Démarrer l'API
pnpm run start:dev
```

| URL                                                                     | Description               |
| ----------------------------------------------------------------------- | ------------------------- |
| `http://localhost:${API_PORT:-3000}/${API_PREFIX:-api/v1}`              | API REST                  |
| `http://localhost:${API_PORT:-3000}/api/docs`                           | Swagger / OpenAPI         |
| `http://localhost:${API_PORT:-3000}/${API_PREFIX:-api/v1}/health/ready` | Health check (DB + Redis) |
| `http://localhost:${API_PORT:-3000}/${API_PREFIX:-api/v1}/metrics`      | Métriques Prometheus      |
| `http://localhost:${MAILPIT_WEB_PORT:-9025}`                            | Mailpit (emails dev)      |
| `http://localhost:${GRAFANA_PORT:-3001}`                                | Grafana (admin/admin)     |
| `http://localhost:${PROMETHEUS_PORT:-9090}`                             | Prometheus                |
| `http://localhost:3002`                                                 | Uptime Kuma               |

## 📊 Comptes de Test

| Email                      | Rôle                   | Mot de passe |
| -------------------------- | ---------------------- | ------------ |
| `admin@telecom.local`      | ADMINISTRATOR          | `Admin@1234` |
| `supervisor@telecom.local` | SUPERVISOR             | `Super@1234` |
| `agent-cc@telecom.local`   | CUSTOMER_SERVICE_AGENT | `Agent@1234` |
| `noc@telecom.local`        | NOC_ENGINEER           | `Agent@1234` |

## 🏗️ Architecture

```
16 modules NestJS · 12 tables PostgreSQL · 45+ routes REST · 5 workers BullMQ
```

| Module           | Responsabilité                                                                  |
| ---------------- | ------------------------------------------------------------------------------- |
| `auth`           | JWT (access 15min + refresh 7j rotation), Argon2id, Redis JTI blacklist         |
| `users`          | CRUD 7 rôles, activation/désactivation, mot de passe temporaire                 |
| `departments`    | 6 départements, soft delete                                                     |
| `tickets`        | State machine 9 statuts, INC-AAAA-NNNNNN, recherche multi-filtres, historique   |
| `comments`       | Commentaires publics (auteur/supervisor/admin)                                  |
| `internal-notes` | Notes internes (restriction FIELD_TECHNICIAN)                                   |
| `attachments`    | Upload/download streaming, interface abstraite IStorageService                  |
| `notifications`  | Inbox pattern, WebSocket temps réel                                             |
| `sla`            | Politiques SLA, cron engine \*/5 min, breach/warning detection                  |
| `dashboard`      | 7 endpoints: overview, status, priority, departments, SLA, workload, resolution |
| `audit-logs`     | Immutable write-only, recherche multi-filtres                                   |
| `email`          | Nodemailer dev/prod, 7 templates Handlebars                                     |
| `reports`        | Génération PDF (PDFKit), rapports asynchrones via BullMQ                        |

## 🔄 Flux Asynchrone (BullMQ)

```
Ticket créé → TicketNotificationListener (@OnEvent)
  ├── EMAIL_QUEUE        → EmailWorker       → SMTP (confirmation, assignation, alerte)
  ├── NOTIFICATION_QUEUE → NotificationWorker → DB + WebSocket emit
  ├── AUDIT_QUEUE        → AuditWorker       → INSERT audit_logs
  └── SLA_QUEUE          → SlaWorker         → Vérification breach (delayed job)

Compte créé → UsersService
  └── EMAIL_QUEUE        → EmailWorker       → Email bienvenue + tempPassword

Mot de passe changé → AuthService
  └── EMAIL_QUEUE        → EmailWorker       → Email confirmation

ReportsController → REPORT_QUEUE → ReportWorker
  ├── NOTIFICATION_QUEUE → NotificationWorker → Notification in-app
  └── EMAIL_QUEUE        → EmailWorker       → Email avec résumé

SlaEngineService (@Cron */5 min)
  ├── DB update (slaBreached = true)
  ├── WebSocket emit (supervisor + assigné)
  ├── NOTIFICATION_QUEUE → NotificationWorker → DB + WebSocket
  └── EMAIL_QUEUE        → EmailWorker       → Alerte SLA
```

## 🛡️ Sécurité

- **Auth**: JWT access + refresh rotation SHA-256, Argon2id (memory 64MB, time 3, parallelism 4)
- **RBAC**: 7 rôles, `JwtAuthGuard` + `RolesGuard` + `@Roles()`
- **Rate Limiting**: Redis distribué (100 req/15min, 10 login/heure/IP)
- **Idempotence**: `@Idempotent()` + header `Idempotency-Key` (cache Redis 24h)
- **Soft Delete**: users, tickets, departments — aucune suppression physique

## 📈 Observabilité

```
NestJS (Pino JSON)
  ├── Logs  → Promtail → Loki → Grafana
  ├── /metrics → Prometheus → Grafana → Alerting (Slack/Email)
  └── Traces → OpenTelemetry → Tempo → Grafana
```

**Métriques exposées**: HTTP requests, duration P95, tickets created, active, SLA breaches, DB pool, WebSocket connections, heap memory.

**6 règles d'alerte**: API down, erreurs 5xx, latence P95 > 2s, SLA breaches, DB connections > 15, heap > 90%.

## 🐳 Docker Compose (13 services)

```bash
make up-full   # Tout démarrer
make down      # Tout arrêter
```

| Service       | Port       |
| ------------- | ---------- |
| API NestJS    | 3000       |
| PostgreSQL 16 | 5432       |
| Redis 7       | 6379       |
| Nginx         | 80, 443    |
| Mailpit       | 1025, 8025 |
| Prometheus    | 9090       |
| Grafana       | 3001       |
| Loki          | 3100       |
| Tempo         | 3200       |
| Promtail      | 9080       |
| Uptime Kuma   | 3002       |

## 📋 Scripts

| Commande                    | Description                  |
| --------------------------- | ---------------------------- |
| `pnpm run start:dev`        | Développement hot-reload     |
| `pnpm run build`            | Compilation TypeScript       |
| `pnpm run test`             | Tests unitaires (113 tests)  |
| `pnpm run test:e2e`         | Tests end-to-end (43 tests)  |
| `pnpm run test:integration` | Tests intégration (10 tests) |
| `pnpm run test:all`         | Tous les tests (166 tests)   |
| `pnpm run test:cov`         | Tests avec couverture        |
| `pnpm run db:push`          | Pousser schéma Drizzle       |
| `pnpm run db:seed`          | Données de test              |
| `pnpm run db:reset`         | db:push + db:seed            |
| `make up`                   | Démarrer services essentiels |
| `make up-full`              | Tous les services Docker     |
| `make help`                 | Aide Makefile                |

## 📚 Documentation

| Fichier                         | Contenu                                   |
| ------------------------------- | ----------------------------------------- |
| `CHANGELOG.md`                  | Historique complet des versions           |
| `docs/routes.md`                | Catalogue complet des 45+ routes          |
| `docs/architecture-flows.md`    | 9 diagrammes Mermaid                      |
| `docs/deployment.md`            | Guide de déploiement production           |
| `docs/emails.md`                | Architecture email, templates, flux       |
| `docs/observability.md`         | Prometheus, Loki, Tempo, Grafana, alertes |
| `docs/websockets.md`            | WebSocket temps réel, rooms, scaling      |
| `docs/jobs-and-workers.md`      | Architecture BullMQ et 5 workers          |
| `docs/implementation-status.md` | État production-readiness                 |
| `.env.example`                  | 60+ variables d'environnement documentées |
