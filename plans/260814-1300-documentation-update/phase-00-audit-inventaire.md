# Phase 00 — Audit et inventaire exact des métriques et des fichiers

## Statut
- État : Terminée (Vérifiée le 14/08/2026)
- Objectif : Recenser l'ensemble des métriques réelles du projet et lister les 20 fichiers `docs/*.md`, `README.md` et `Makefile`.

## Métriques certifiées (Source du Code)
1. **Modules NestJS** : 25 modules sous `src/modules/` (`app`, `attachments`, `audit-logs`, `auth`, `categories`, `comments`, `dashboard`, `departments`, `email`, `external-delivery`, `external-identity`, `external-requesters`, `internal-notes`, `notifications`, `outbox`, `public-support`, `reports`, `settings`, `sla`, `support-bot`, `support-integrations`, `support-knowledge`, `support-satisfaction`, `tickets`, `users`) + 2 modules racines (`queues`, `websocket`).
2. **Tables PostgreSQL (Drizzle)** : 31 tables (`attachments`, `audit_logs`, `categories`, `departments`, `external_deliveries`, `external_identities`, `external_requesters`, `external_verification_challenges`, `idempotency_records`, `integration_credentials`, `notifications`, `outbox_events`, `public_bootstrap_grants`, `refresh_tokens`, `reports`, `settings`, `sla_policies`, `support_conversations`, `support_integrations`, `support_knowledge_articles`, `support_knowledge_versions`, `support_knowledge_grants`, `support_messages`, `ticket_assignments`, `ticket_comments`, `ticket_history`, `ticket_internal_notes`, `ticket_satisfaction`, `tickets`, `trusted_devices`, `users`).
3. **Contrat OpenAPI Interne** : 115 chemins, 139 opérations (`openapi.json`).
4. **Contrat OpenAPI Public** : 30 chemins, 33 opérations (`openapi.public.json`).
5. **Suite de Tests Unitaires / Spec** : 89 fichiers `.spec.ts` sous `src/` (582 tests réussis).
6. **Suite de Tests E2E / Intégration** : 20 fichiers sous `test/`.
7. **Queues & Workers BullMQ** : 8 queues (`ASSIGNMENT`, `ATTACHMENT_SCAN`, `AUDIT`, `EMAIL`, `EXTERNAL_DELIVERY`, `NOTIFICATION`, `REPORT`, `SLA`) et 8 workers.
8. **Templates Email** : 15 templates Handlebars sous `src/modules/email/templates/` (`base.hbs` layout + 14 templates de corps).
9. **Gateways WebSocket** : 2 namespaces Socket.IO (`/ws` interne authentifié, `/public-support` public).
10. **Comptes de Test & Seed** : 105 comptes SSO Keycloak (`agent.<ROLE>.<1..15>@telecom.local`) + 14 utilisateurs seed PostgreSQL.
11. **Variables d'environnement** : 147 variables documentées dans `.env.example`.

## Fichiers de documentation concernés (20 fichiers + README + Makefile)
1. `README.md`
2. `Makefile`
3. `docs/architecture-flows.md`
4. `docs/auth-guide.md`
5. `docs/database-schema.md`
6. `docs/deployment.md`
7. `docs/detailed-design-assignment-sla.md`
8. `docs/domain-events.md`
9. `docs/emails.md`
10. `docs/environment-variables.md`
11. `docs/implementation-status.md`
12. `docs/jobs-and-workers.md`
13. `docs/observability.md`
14. `docs/quick-start.md`
15. `docs/routes.md`
16. `docs/security.md`
17. `docs/test-accounts.md`
18. `docs/testing.md`
19. `docs/ticket-lifecycle.md`
20. `docs/troubleshooting.md`
21. `docs/websockets.md`
22. `docs/workers.md`
