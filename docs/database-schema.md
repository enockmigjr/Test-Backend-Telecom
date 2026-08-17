# Schéma de la Base de Données

Dernière mise à jour : 2026-08-12

## Vue d'ensemble

**31 tables PostgreSQL** (vérifié : 31 définitions `pgTable` dans `src/database/schemas/`) avec UUIDv7 comme clé primaire. Soft delete sur `users`, `tickets` et `departments`. Le schéma source est défini par Drizzle (`src/database/schemas/*.ts`) et les migrations additives se trouvent dans `src/database/migrations/` (20 migrations).

### Groupes de tables

| Groupe              | Tables                                                                                                                                                                                                                                                                                                              |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Noyau (14)          | departments, users, categories, tickets, ticket_assignments, ticket_comments, ticket_internal_notes, ticket_history, attachments, notifications, sla_policies, audit_logs, reports, settings                                                                                                                        |
| Support public (13) | support_integrations, integration_credentials, external_requesters, external_identities, external_verification_challenges, trusted_devices, public_bootstrap_grants, support_conversations, support_messages, support_knowledge_articles, support_knowledge_versions, support_knowledge_grants, ticket_satisfaction |
| Fiabilité (3)       | outbox_events, external_deliveries, idempotency_records                                                                                                                                                                                                                                                             |

## Tables principales

### `users`

| Colonne                                                   | Type      | Description                                  |
| --------------------------------------------------------- | --------- | -------------------------------------------- |
| `id`                                                      | UUID (PK) | UUIDv7                                       |
| `email`                                                   | VARCHAR   | Unique, NOT NULL                             |
| `password_hash`                                           | VARCHAR   | Argon2id hash                                |
| `first_name` / `last_name`                                | VARCHAR   | Nom complet                                  |
| `role`                                                    | ENUM      | 7 rôles                                      |
| `department_id`                                           | UUID (FK) | → `departments.id`                           |
| `is_active`                                               | BOOLEAN   | Défaut `true`                                |
| `is_available`                                            | BOOLEAN   | Défaut `true` — pause/reprise self-service   |
| `absence_ends_at`                                         | TIMESTAMP | Fin d'absence planifiée                      |
| `keycloak_subject_id`                                     | VARCHAR   | Lien SSO Keycloak (en cours, migration 0019) |
| `must_change_password`                                    | BOOLEAN   | Premier login                                |
| `last_login_at`, `created_at`, `updated_at`, `deleted_at` | TIMESTAMP | Audits et soft delete                        |

### `tickets`

| Colonne                                                         | Type                | Description                                                   |
| --------------------------------------------------------------- | ------------------- | ------------------------------------------------------------- |
| `id`                                                            | UUID (PK)           | UUIDv7                                                        |
| `ticket_number`                                                 | VARCHAR             | `INC-AAAA-NNNNNN` (unique)                                    |
| `title` / `description`                                         | VARCHAR / TEXT      | Contenu                                                       |
| `status`                                                        | ENUM                | 9 statuts                                                     |
| `priority` / `severity`                                         | ENUM                | LOW→CRITICAL / S1→S4                                          |
| `category_id` / `sla_policy_id`                                 | UUID (FK)           | Catégorie et politique SLA                                    |
| `department_id` / `assigned_team_id`                            | UUID (FK)           | Département propriétaire / équipe technique                   |
| `created_by`                                                    | UUID (FK, nullable) | Légacy, remplacé par les colonnes d'acteur                    |
| `opened_by_user_id`                                             | UUID (FK)           | Acteur interne ouvreur                                        |
| `requester_id` / `support_integration_id`                       | UUID (FK)           | Demandeur externe + intégration (paire contrainte)            |
| `source_channel`                                                | ENUM                | INTERNAL, WEB_PORTAL, WIDGET, WORDPRESS, EMAIL, WHATSAPP, API |
| `assigned_to`                                                   | UUID (FK)           | Agent assigné                                                 |
| `first_response_due_at` / `resolution_due_at`                   | TIMESTAMP           | Échéances SLA                                                 |
| `first_response_warning_sent_at` / `first_response_breached_at` | TIMESTAMP           | Suivi SLA 1re réponse                                         |
| `resolution_warning_sent_at` / `resolution_breached_at`         | TIMESTAMP           | Suivi SLA résolution                                          |
| `sla_breached`                                                  | BOOLEAN             | Violation d'au moins un SLA                                   |
| `sla_paused_at` / `accumulated_pause_ms`                        | TIMESTAMP / INTEGER | Pause SLA (PENDING)                                           |
| `resolved_at` / `closed_at`                                     | TIMESTAMP           | Jalons                                                        |
| `metadata`                                                      | JSONB               | Métadonnées (relances de violation…)                          |
| `created_at`, `updated_at`, `deleted_at`                        | TIMESTAMP           | Audits et soft delete                                         |

Contraintes d'acteur (SQL) : `tickets_actor_presence_check` (au moins un acteur), `tickets_legacy_creator_check`, `tickets_requester_integration_check` (requester et intégration ensemble ou pas du tout).

### `departments`

`id`, `name` (unique), `description`, `auto_assignment_enabled`, `assignment_strategy` (ROUND_ROBIN/LEAST_LOADED), `max_workload_per_agent`, `workload_weights` (JSONB), `created_at`, `updated_at`, `deleted_at`.

### `categories`

`id`, `name` (unique), `description`, `target_role`, `target_roles` (tableau), `created_at`, `updated_at`.

### `sla_policies`

`id`, `category_id` (FK), `priority`, `first_response_minutes`, `resolution_minutes`, `created_at`, `updated_at`. Contrainte unique `(category_id, priority)`.

## Tables support public (résumé)

| Table                                                  | Rôle                                                                                  |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| `support_integrations`                                 | Tenant/site : clé publique, origines, apparence, routage, quotas, confiance, features |
| `integration_credentials`                              | Secrets d'intégration chiffrés AES-256-GCM, versionnés, avec rotation                 |
| `external_requesters`                                  | Profil du demandeur public (nom, locale, anonymisation)                               |
| `external_identities`                                  | Identités vérifiées (EMAIL/PHONE/WORDPRESS), valeurs chiffrées                        |
| `external_verification_challenges`                     | Challenges OTP (code haché, tentatives, expiration)                                   |
| `trusted_devices`                                      | Appareils de confiance (jeton haché, politique versionnée, expiration)                |
| `public_bootstrap_grants`                              | Codes de transfert iframe → pleine page (usage unique)                                |
| `support_conversations`                                | Conversations pré-ticket (état QUALIFY/DRAFT/CREATED/FOLLOW_UP…)                      |
| `support_messages`                                     | Messages de transport de canal, liés aux conversations/tickets                        |
| `support_knowledge_articles` / `_versions` / `_grants` | Base documentaire publique versionnée, cloisonnée par intégration                     |
| `ticket_satisfaction`                                  | Liens de satisfaction (jeton haché, note 1-5, expiration)                             |

## Tables fiabilité

| Table                 | Rôle                                                                                                                |
| --------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `outbox_events`       | Événements durables écrits dans la transaction métier (statuts PENDING/PROCESSING/PUBLISHED/FAILED, retries bornés) |
| `external_deliveries` | État observable d'une livraison par canal (PENDING/PROCESSING/DELIVERED/FAILED/DELIVERY_UNKNOWN)                    |
| `idempotency_records` | Clés d'idempotence (sujet, méthode, chemin, fingerprint, TTL 24 h)                                                  |

## ENUMs

- `role_enum` : ADMINISTRATOR, SUPERVISOR, CUSTOMER_SERVICE_AGENT, NOC_ENGINEER, BILLING_AGENT, TECHNICAL_SUPPORT_ENGINEER, FIELD_TECHNICIAN
- `ticket_status_enum` : NEW, ASSIGNED, IN_PROGRESS, PENDING_CUSTOMER, PENDING_THIRD_PARTY, RESOLVED, CLOSED, REOPENED, CANCELLED
- `ticket_priority_enum` : LOW, MEDIUM, HIGH, CRITICAL
- `ticket_severity_enum` : S1, S2, S3, S4
- `notification_type_enum` : TICKET_ASSIGNED, TICKET_ESCALATED, TICKET_RESOLVED, COMMENT_ADDED, SLA_WARNING, SLA_BREACHED, REPORT_READY, REPORT_FAILED
- `actor_type_enum` : INTERNAL, EXTERNAL_REQUESTER, SYSTEM
- `support_channel_enum` : INTERNAL, WEB_PORTAL, WIDGET, WORDPRESS, EMAIL, WHATSAPP, API
- `knowledge_status_enum` : DRAFT, PUBLISHED, ARCHIVED
- `integration_status_enum` : DRAFT, ACTIVE, SUSPENDED
- `external_identity_type_enum` : EMAIL, PHONE, WORDPRESS
- `verification_challenge_status_enum` : PENDING, VERIFIED, EXPIRED, LOCKED
- `conversation_status_enum` : OPEN, TICKET_CREATED, CLOSED, ABANDONED
- `support_message_direction_enum` : INBOUND, OUTBOUND
- `outbox_status_enum` : PENDING, PROCESSING, PUBLISHED, FAILED
- `delivery_status_enum` : PENDING, PROCESSING, DELIVERED, FAILED, DELIVERY_UNKNOWN
- `attachment_scan_status_enum` : NOT_REQUIRED, QUARANTINED, PENDING, SCANNING, CLEAN, INFECTED, ERROR
- `idempotency_subject_type_enum` : INTERNAL, EXTERNAL_REQUESTER, INTEGRATION

## Seed Data

Créés par `pnpm run db:seed` : départements, 14 utilisateurs, catégories, politiques SLA, settings, intégrations de démo. Voir `docs/test-accounts.md` et README pour les identifiants.
