# État d'Implémentation — Production Readiness

Dernière mise à jour : 2026-08-12

## ✅ Prod-Ready

| Composant | Notes |
| --- | --- |
| Auth JWT | Login, refresh rotation (familles de jetons), logout, logout-all, change-password, Argon2id, blacklist Redis JTI, fail-open configurable |
| RBAC 7 rôles | JwtAuthGuard + RolesGuard + @Roles() + PasswordChangeRequiredGuard ; RequestAuthGuard aiguille 4 modes d'auth (INTERNAL, PUBLIC_SESSION, INTEGRATION_ASSERTION, ANONYMOUS) |
| Rate Limiting | Redis distribué (ThrottlerStorageRedisService avec repli mémoire), défauts 1000 req/15min et 20 login/heure (configurables) |
| CRUD Users | 7 rôles, activation/désactivation, mot de passe temporaire par email, pause/reprise/absence des agents |
| CRUD Departments | Soft delete, protection si users/tickets liés, configuration d'assignation (stratégie, charge max, pondérations) |
| Tickets | State machine 9 statuts, ABAC par champ, acteurs INTERNAL/EXTERNAL_REQUESTER/SYSTEM, INC-AAAA-NNNNNN, auto-clôture 48h, pause SLA |
| Auto-Assignation | Moteur périodique (cron 2 min) + événementiel (assignment-queue), ROUND_ROBIN/LEAST_LOADED, désassignation d'urgence, escalade des tickets en retard |
| Comments / Notes | Commentaires publics, réponse explicite au demandeur (option B), corrections liées, notes internes interdites aux FIELD_TECHNICIAN |
| Attachments | Upload/download streaming, IStorageService abstrait ; parcours public en quarantaine + ClamAV + quotas + idempotence |
| Notifications | Inbox pattern, WebSocket temps réel, mark-read / mark-all-read |
| SLA | Politiques catégorie × priorité, cron */5 min, warning/breach (1re réponse + résolution), claim atomique, relances bornées |
| Dashboard | Overview, statuts, priorités, départements, SLA, workload, temps de résolution, performance agents, Mon activité, stats support public |
| Audit Logs | Immutable write-only, recherche multi-filtres, isolation superviseur par département |
| WebSocket | 2 namespaces : `/ws` (interne, rooms user/department/session) et `/public-support` (public, rooms requester), RedisIoAdapter |
| BullMQ | 8 files (email, notification, sla, audit, report, assignment, external-delivery, attachment-scan) et 8 workers, tous enregistrés dans `QueuesModule` |
| Domain Events | EventEmitter2 (tickets, auth, SLA, satisfaction) + 15+ événements outbox écrits dans la transaction métier |
| Swagger | 28 tags, 144 opérations OpenAPI (120 chemins) ; contrat public projeté `openapi.public.json` (33 opérations), tests de non-fuite |
| Prometheus / Grafana | 10 métriques custom + defaults, alerting, dashboards |
| OpenTelemetry | SDK auto-instrumentation (HTTP, Express, NestJS, PostgreSQL, Redis) → Tempo |
| Email | Nodemailer dev (Mailpit)/prod, 15 templates Handlebars + layout base.hbs, repli générique sans contenu dupliqué |
| PDF Reports | PDFKit premium, génération asynchrone, lien signé HMAC expirable, notification succès/échec |
| Support public | Portail + widget (public-frontend), admission (catalogue, routage, impact × urgence), conversations, timeline publique, préférences |
| Identité publique | OTP email, appareils de confiance 90 j, assertions WordPress, session publique JWT distincte, quotas anti-abus, identités chiffrées AES-GCM |
| Outbox + livraisons | `outbox_events` transactionnels, publication 1 s, `external_deliveries` (statuts, lease, rejeu), adaptateur email |
| Connaissance + bot | Base documentaire versionnée par intégration ; bot optionnel (budget, circuit breaker, outils fermés, repli formulaire) |
| Satisfaction | Lien signé unique (TTL 14 j), note 1-5 + commentaire, stats, email automatique à la clôture d'un ticket public |
| Rétention / RGPD | Anonymisation automatique des demandeurs inactifs, purge challenges/idempotences, fusion de profils avec audit |
| Docker Compose | 15 services, URLs/credentials en variables d'environnement, ClamAV et Keycloak inclus |
| Health Checks | `/health` (liveness) et `/health/ready` (PostgreSQL, Redis, files, ClamAV) |
| Idempotence | `@Idempotent()` / `@RequireIdempotency()` + table `idempotency_records` (TTL 24 h, fingerprint, 409 sur rejeu différent) |
| Configuration | 143 variables documentées dans `.env.example`, paramètres système dynamiques en base |
| Contrats OpenAPI | Export déterministe (`pnpm run openapi:export`), tri stable, garde CI sur snapshot |

## 🔶 Reste à faire

| Composant | Notes |
| --- | --- |
| S3/MinIO Storage | Interface IStorageService prête, implémentation à ajouter |
| Auto-escalade | Si SLA breach + auto_escalate → escalader au supervisor |
| Rétention | Validation de la rétention/anonymisation sur données réelles et arbitrage du fail-open Redis |
| Bot | Clé API fournisseur (`PUBLIC_SUPPORT_BOT_API_KEY`) requise pour activer le bot |
| SSO Keycloak | Phases 6 à 8 du plan `260812-1040-keycloak-sso-evaluation` (déploiement prod, Keycloak + Keycloakify, config admin étendue) |
| Tests | 92 fichiers spec (628 tests / 92 suites, vérifiés le 12/08/2026) + 24 fichiers E2E/intégration |

## Verdict

Le backend est complet et structuré (25 modules, 31 tables, 144 opérations OpenAPI, 8 files/workers). La priorité n'est plus d'ajouter des briques mais de finir les chantiers engagés (phase 09 support public, Keycloak, validation de la rétention) et de maintenir les contrats et la documentation à jour.
