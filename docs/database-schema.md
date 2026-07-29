# Schéma de la Base de Données

## Vue d'ensemble

15 tables PostgreSQL avec UUIDv7 comme clé primaire. Soft delete sur `users`, `tickets` et `departments`.

---

## Tables

### `users`

| Colonne                | Type      | Description                    |
| ---------------------- | --------- | ------------------------------ |
| `id`                   | UUID (PK) | UUIDv7                         |
| `email`                | VARCHAR   | Unique, NOT NULL               |
| `password_hash`        | VARCHAR   | Argon2id hash                  |
| `first_name`           | VARCHAR   | Prénom                         |
| `last_name`            | VARCHAR   | Nom de famille                 |
| `role`                 | ENUM      | 7 rôles (voir ci-dessous)      |
| `department_id`        | UUID (FK) | → `departments.id`             |
| `is_active`            | BOOLEAN   | Défaut: `true`                 |
| `must_change_password` | BOOLEAN   | Défaut: `true` (premier login) |
| `created_at`           | TIMESTAMP | Défaut: `NOW()`                |
| `updated_at`           | TIMESTAMP | Mis à jour automatiquement     |
| `deleted_at`           | TIMESTAMP | NULL = actif (soft delete)     |

### `departments`

| Colonne       | Type      | Description |
| ------------- | --------- | ----------- |
| `id`          | UUID (PK) | UUIDv7      |
| `name`        | VARCHAR   | Unique      |
| `description` | TEXT      | Description |
| `created_at`  | TIMESTAMP |             |
| `updated_at`  | TIMESTAMP |             |
| `deleted_at`  | TIMESTAMP | Soft delete |

Départements par défaut : Administration, Customer Care, NOC, Billing, Technical Support, Field Operations.

### `tickets`

| Colonne                 | Type      | Description                        |
| ----------------------- | --------- | ---------------------------------- |
| `id`                    | UUID (PK) | UUIDv7                             |
| `ticket_number`         | VARCHAR   | Format: `INC-AAAA-NNNNNN` (unique) |
| `title`                 | VARCHAR   | Titre du ticket                    |
| `description`           | TEXT      | Description détaillée              |
| `status`                | ENUM      | 9 statuts (voir state machine)     |
| `priority`              | ENUM      | LOW, MEDIUM, HIGH, CRITICAL        |
| `severity`              | ENUM      | S1, S2, S3, S4                     |
| `category_id`           | UUID (FK) | → `categories.id`                  |
| `sla_policy_id`         | UUID (FK) | → `sla_policies.id`                |
| `department_id`         | UUID (FK) | Département d'origine              |
| `assigned_team_id`      | UUID (FK) | Département assigné                |
| `created_by`            | UUID (FK) | → `users.id`                       |
| `assigned_to`           | UUID (FK) | → `users.id` (nullable)            |
| `first_response_at`     | TIMESTAMP | Heure de première réponse          |
| `resolved_at`           | TIMESTAMP | Heure de résolution                |
| `closed_at`             | TIMESTAMP | Heure de clôture                   |
| `first_response_due_at` | TIMESTAMP | SLA première réponse               |
| `resolution_due_at`     | TIMESTAMP | SLA résolution                     |
| `sla_breached`          | BOOLEAN   | SLA violé ?                        |
| `resolution_summary`    | TEXT      | Résumé de résolution               |
| `created_at`            | TIMESTAMP |                                    |
| `updated_at`            | TIMESTAMP |                                    |
| `deleted_at`            | TIMESTAMP | Soft delete                        |

### `categories`

| Colonne       | Type      | Description                      |
| ------------- | --------- | -------------------------------- |
| `id`          | UUID (PK) | UUIDv7                           |
| `name`        | VARCHAR   | Unique                           |
| `description` | TEXT      |                                  |
| `target_role` | VARCHAR   | Rôle cible pour auto-assignation |
| `created_at`  | TIMESTAMP |                                  |
| `updated_at`  | TIMESTAMP |                                  |

### `sla_policies`

| Colonne                  | Type      | Description                    |
| ------------------------ | --------- | ------------------------------ |
| `id`                     | UUID (PK) | UUIDv7                         |
| `category_id`            | UUID (FK) | → `categories.id`              |
| `priority`               | ENUM      | LOW, MEDIUM, HIGH, CRITICAL    |
| `first_response_minutes` | INTEGER   | SLA première réponse (minutes) |
| `resolution_minutes`     | INTEGER   | SLA résolution (minutes)       |
| `created_at`             | TIMESTAMP |                                |
| `updated_at`             | TIMESTAMP |                                |

Contrainte unique : `(category_id, priority)`.

### Autres tables

| Table                   | Description                               |
| ----------------------- | ----------------------------------------- |
| `ticket_assignments`    | Historique des assignations               |
| `ticket_comments`       | Commentaires publics                      |
| `ticket_internal_notes` | Notes internes (pas FIELD_TECHNICIAN)     |
| `ticket_history`        | Historique des changements d'état         |
| `attachments`           | Pièces jointes (tickets/comments/notes)   |
| `notifications`         | Notifications in-app                      |
| `audit_logs`            | Piste d'audit immutable                   |
| `refresh_tokens`        | Tokens de rafraîchissement (hash SHA-256) |
| `reports`               | Rapports générés (PDF)                    |
| `settings`              | Paramètres système dynamiques             |

---

## ENUMs

### `role_enum`

```
ADMINISTRATOR, SUPERVISOR, CUSTOMER_SERVICE_AGENT, NOC_ENGINEER,
BILLING_AGENT, TECHNICAL_SUPPORT_ENGINEER, FIELD_TECHNICIAN
```

### `ticket_status_enum`

```
NEW, ASSIGNED, IN_PROGRESS, PENDING_CUSTOMER, PENDING_THIRD_PARTY,
RESOLVED, CLOSED, REOPENED, CANCELLED
```

### `ticket_priority_enum`

```
LOW, MEDIUM, HIGH, CRITICAL
```

### `ticket_severity_enum`

```
S1, S2, S3, S4
```

---

## State Machine — Transitions de statut

```
NEW → ASSIGNED → IN_PROGRESS
                    ├── PENDING_CUSTOMER → IN_PROGRESS
                    ├── PENDING_THIRD_PARTY → IN_PROGRESS
                    └── RESOLVED → CLOSED
                                    └── REOPENED → IN_PROGRESS

Depuis tout statut (sauf CLOSED/CANCELLED) → CANCELLED
```

---

## Seed Data (14 utilisateurs)

Créés par `pnpm run db:seed`. Voir README.md pour la liste complète avec les emails et mots de passe.
