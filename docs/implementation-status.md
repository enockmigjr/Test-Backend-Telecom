# État d'Implémentation — Production Readiness

Ce document liste ce qui est **prod-ready**, ce qui nécessite du travail supplémentaire, et ce qui est planifié.

---

## ✅ Prod-Ready (implémenté et stable)

| Composant | Statut | Notes |
|-----------|--------|-------|
| **Auth JWT** | ✅ | Login, refresh (rotation SHA-256), logout, logout-all, change-password. Argon2id. Redis JTI blacklist. |
| **Guards RBAC** | ✅ | JwtAuthGuard, RolesGuard avec @Roles() decorator |
| **Rate Limiting** | ✅ | Redis-backed via ThrottlerStorageRedisService. 100 req/15min général, 10 login/heure/IP |
| **CRUD Utilisateurs** | ✅ | 7 rôles, activation/désactivation, mot de passe temporaire |
| **CRUD Départements** | ✅ | Protection suppression si users/tickets liés |
| **Tickets — Création** | ✅ | State machine, numérotation INC-AAAA-NNNNNN via séquence PostgreSQL |
| **Tickets — Recherche** | ✅ | Filtres combinés (status, priority, category, assignedTo, search texte, dates) |
| **Tickets — Cycle de vie** | ✅ | assign, escalate, resolve, close, reopen avec validation des transitions |
| **Tickets — Historique** | ✅ | ticket_history enregistré via TicketHistoryService |
| **Commentaires publics** | ✅ | CRUD avec restriction auteur/supervisor/admin |
| **Notes internes** | ✅ | CRUD avec restriction FIELD_TECHNICIAN |
| **Pièces jointes** | ✅ | Upload/download/suppression, stockage local (interface abstraite pour S3) |
| **Notifications in-app** | ✅ | Inbox pattern, read/unread, mark-all-read |
| **Politiques SLA** | ✅ | CRUD avec UNIQUE(category, priority) |
| **SLA Engine** | ✅ | Cron */5 min, breach detection, notInArray correct |
| **Dashboard — Overview** | ✅ | KPIs avec plage de dates, par statut, par priorité |
| **Dashboard — Workload** | ✅ | Charge par agent + unassigned count |
| **Audit Logs** | ✅ | Immutable (write-only), recherche avec filtres |
| **WebSocket Gateway** | ✅ | JWT auth on connect, rooms user/department/role |
| **Global Exception Filter** | ✅ | Format standardisé: `{success, error: {code, message, details, correlationId, timestamp}}` |
| **Correlation ID** | ✅ | Middleware, propagation via AsyncLocalStorage |
| **BullMQ Queues** | ✅ | 4 queues définies: email, notification, sla, audit |
| **Docker Compose** | ✅ | PostgreSQL, Redis, Nginx, API, Mailpit |

---

## 🔶 Presque Prêt (nécessite finalisation)

| Composant | Statut | Action requise |
|-----------|--------|----------------|
| **UUID v7** | 🔶 | Helper `generateUuid()` créé. Les services utilisent encore `uuidv4()` — remplacer progressivement |
| **Audit Trail complet** | 🔶 | Colonnes `createdBy`, `updatedBy`, `deletedBy` définies dans `audit.helper.ts`. Schémas à mettre à jour. |
| **Health Checks** | 🔶 | Endpoint `/health` à implémenter avec `@nestjs/terminus` (PostgreSQL + Redis) |
| **Prometheus Metrics** | 🔶 | `prom-client` installé. Endpoint `/metrics` à exposer. |
| **Pino + Loki** | 🔶 | Logger Pino configuré. Transport Loki à ajouter en production. |
| **OpenTelemetry Tracing** | 🔶 | SDK à instrumenter (auto-instrumentation NestJS). |
| **Tests unitaires** | 🔴 | Auth, state machine, services critiques nécessitent des tests |
| **Tests E2E** | 🔴 | Workflows complets à tester (création → résolution ticket) |
| **Email Templates** | 🔶 | Handlebars installé. Templates `.hbs` à créer dans `src/modules/email/templates/` |
| **Seed Data** | 🔶 | Script `run-seed.ts` fonctionnel mais doit utiliser `uuidv7()` |

---

## ❌ Non Implémenté (planifié)

| Composant | Notes |
|-----------|-------|
| **BullMQ Workers** | Les queues sont définies mais les workers (processeurs) ne sont pas encore implémentés |
| **Upload vers S3/MinIO** | Le `IStorageService` est abstrait. Seule l'implémentation `LocalStorageService` existe. après mais pas pour le moment|
| **Grafana Dashboards** | Les JSON de dashboards ne sont pas encore créés dans `grafana/dashboards/` |
| **GitHub Actions CI/CD** | Fichier `.github/workflows/ci.yml` à créer |
| **Husky pre-commit** | Configuration Husky + lint-staged à ajouter |
| **Nginx TLS** | Certificats SSL/TLS à configurer pour la production |

---

## Travaux par Priorité

### Priorité 1 — Bloquant pour la Production
1. ✅ Rate limiting Redis (fait)
2. ✅ SLA Engine SQL corrigé (fait)
3. 🔶 Workers BullMQ (email, notification, SLA, audit)
4. 🔶 Health checks `/health` + `/health/ready`
5. 🔶 Métriques Prometheus `/metrics`

### Priorité 2 — Important
6. 🔶 Tests unitaires (auth, state machine, search)
7. 🔶 Tests E2E (workflow ticket complet)
8. 🔶 UUID v7 partout
9. 🔶 CI/CD GitHub Actions

### Priorité 3 — Amélioration Continue
10. ❌ Templates email Handlebars
11. ❌ Grafana dashboards
12. ❌ OpenTelemetry instrumentation
13. ❌ S3/MinIO storage backend après mais pas pour le moment
