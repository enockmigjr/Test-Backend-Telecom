# État d'Implémentation — Production Readiness

Dernière mise à jour: 2026-07-08 (v1.4.0)

## ✅ Prod-Ready

| Composant         | Notes                                                                                                                            |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Auth JWT          | Login, refresh rotation, logout, logout-all, change-password, Argon2id, Redis JTI blacklist                                      |
| RBAC 7 rôles      | JwtAuthGuard + RolesGuard + @Roles() decorator                                                                                   |
| Rate Limiting     | Redis distribué (ThrottlerStorageRedisService), 100 req/15min, 10 login/heure                                                    |
| CRUD Users        | 7 rôles, activation/désactivation, mot de passe temporaire envoyé par email                                                      |
| CRUD Departments  | Soft delete, protection si users/tickets liés                                                                                    |
| Tickets           | State machine 9 statuts + 2 pending, cloisonnement ABAC départemental (Superviseurs et agents restreints à leur département d'origine), INC-AAAA-NNNNNN, filtres combinés, historique, auto-clôture 48h |
| Auto-Assignation  | Moteur d'auto-assignation périodique (toutes les 2 min) + évènementiel asynchrone (BullMQ assignment-queue). Stratégies ROUND_ROBIN et LEAST_LOADED. Gestion des indisponibilités avec désassignation d'urgence en cas de risque SLA et notification email/in-app. Mappage dynamique catégorie -> rôle cible (`target_role`). Exclusion des Administrateurs et Superviseurs. |
| Comments          | CRUD avec restriction auteur/supervisor/admin                                                                                    |
| Internal Notes    | CRUD avec restriction FIELD_TECHNICIAN                                                                                           |
| Attachments       | Upload/download streaming, IStorageService abstrait                                                                              |
| Notifications     | Inbox pattern, WebSocket temps réel, mark-read, mark-all-read                                                                    |
| SLA Policies      | CRUD UNIQUE(categoryId, priority) avec heures et jours ouvrables configurables dynamiquement en base de données                   |
| SLA Engine        | Cron \*/5 min, breach/warning detection, email + notification + WebSocket                                                        |
| Dashboard         | 7 endpoints: overview, status, priority, departments, SLA, workload, resolution                                                  |
| Audit Logs        | Immutable write-only, recherche multi-filtres                                                                                    |
| WebSocket Gateway | JWT auth, rooms user/department/role, RedisIoAdapter (scaling)                                                                   |
| BullMQ Queues     | 6 files: email, notification, sla, audit, report, assignment                                                                     |
| BullMQ Workers    | 6 workers: Email, Notification, SLA, Audit, Report, Assignment — tous avec notification + email intégrés                         |
| Domain Events     | 11 événements + 4 listeners @OnEvent (notification, audit, SLA, assignation)                                                     |
| Swagger           | 14 tags, @ApiOperation/@ApiResponse/@ApiParam/@ApiQuery/@ApiBody sur tous les endpoints                                          |
| Prometheus        | 9 métriques custom + defaults Node.js, /metrics OpenMetrics                                                                      |
| Grafana           | 3 dashboards JSON + 3 datasources (Prometheus, Loki, Tempo)                                                                      |
| Alerting          | 6 règles Prometheus: API down, 5xx, latence, SLA, DB, heap                                                                       |
| OpenTelemetry     | SDK auto-instrumentation (HTTP, Express, NestJS, PostgreSQL, Redis)                                                              |
| Email             | Nodemailer dev/prod auto-switch, 11 flux email actifs, 10 templates Handlebars (dont ticketDeassigned) + layout global base.hbs  |
| PDF Reports       | PDFKit premium stylisé avec grilles et en-têtes de marque, rapports asynchrones et envoi automatique en pièce jointe d'e-mail    |
| Docker Compose    | 13 services, toutes les URLs/credentials en variables d'environnement                                                            |
| Health Checks     | /health (liveness), /health/ready (PostgreSQL + Redis)                                                                           |
| Idempotence       | @Idempotent() + header Idempotency-Key, cache Redis 24h                                                                          |
| Field Projection  | ?detail=summary full sur GET /tickets, /users, /dashboard                                                                        |
| UUID v7           | Partout (generateUuid)                                                                                                           |
| Soft Delete       | departments, users, tickets                                                                                                      |
| CI/CD             | GitHub Actions: 7 jobs (lint, test, build, e2e, security, docker , semgrep)                                                      |
| CD                | GitHub Actions: build & push Docker vers GHCR                                                                                    |
| Makefile          | 20 commandes                                                                                                                     |
| BullBoard         | Interface de supervision des 6 queues BullMQ à /admin/queues                                                                     |
| Token Cleanup     | Cron quotidien 3h — supprime refresh_tokens expirés + révoqués >30j                                                              |
| Documentation     | 9 fichiers docs/, CHANGELOG v1.3.0, README à jour, .env.example 70+ variables                                                    |
| Tests             | **453 unitaires** + **103 E2E** = **556 tests**, 32 suites (100% de réussite)                                                    |
| Build             | TypeScript strict, zéro erreur                                                                                                   |
| Observabilité     | Vue matérialisée PostgreSQL pour la consolidation du workload, sécurisée par vérification d'existence avant rafraîchissement     |
| Configuration     | Paramètres système globaux dynamiques en DB via `/settings` (Heures de bureau, Jours ouvrables, Charge max tickets) avec cache   |

## 🔶 Reste à faire

| Composant        | Notes                                                     |
| ---------------- | --------------------------------------------------------- |
| S3/MinIO Storage | Interface IStorageService prête, implémentation à ajouter |
| Auto-escalade    | Si SLA breach + auto_escalate → escalader au supervisor   |
