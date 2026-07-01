---
# yaml-language-server: $schema=schemas\page.schema.json
Object type:
  - Page
Creation date: '2026-06-22T09:14:05Z'
Created by:
  - Enock Junior
id: bafyreie3fnspg2n26xozggzfnfubxyr3cf24hf4tckxyjwq6hrow23tjiq
---

# Phase 2 – Database Design

# 1. Introduction

## Objectif

Cette phase présente la conception de la base de données du système de gestion d'incidents télécoms.  
L'objectif du modèle de données est de garantir :

- l'intégrité des données ;
- la traçabilité complète des opérations ;
- la conservation des historiques ;
- de bonnes performances de lecture et d'écriture ;
- l'évolutivité du système.

La solution retenue repose sur PostgreSQL en raison de sa robustesse, de son support avancé des contraintes relationnelles, de ses types de données modernes (JSONB, ARRAY, ENUM) et de ses excellentes performances.

---

# 2. Principes de conception

## Intégrité référentielle

Toutes les relations importantes sont protégées par des clés étrangères afin d'éviter les incohérences.  
Exemples :

- Un ticket doit appartenir à un département.
- Un commentaire doit appartenir à un ticket existant.
- Une notification doit appartenir à un utilisateur existant.
  ***

## Auditabilité

Le système doit permettre de reconstruire l'historique complet d'un incident.  
Pour cette raison :

- les affectations sont historisées ;
- les changements importants sont journalisés ;
- les suppressions sont logiques (Soft Delete).
  ***

## Évolutivité

Le modèle a été conçu pour permettre :

- l'ajout futur de nouveaux départements ;
- l'ajout de nouveaux types de notifications ;
- l'intégration de nouveaux systèmes de stockage ;
- l'évolution vers une architecture distribuée.
  ***

## Performance

Les index sont définis en fonction des cas d'usage réels :

- recherche de tickets ;
- tableaux de bord ;
- affectations ;
- calcul des SLA ;
- reporting.
  ***

# 3. Types ENUM PostgreSQL

Afin de garantir la cohérence des données, plusieurs ENUM PostgreSQL sont utilisés.

## role_enum

```
ADMINISTRATOR

SUPERVISOR

CUSTOMER_SERVICE_AGENT

NOC_ENGINEER

BILLING_AGENT

TECHNICAL_SUPPORT_ENGINEER

FIELD_TECHNICIAN


```

---

## ticket_status_enum

```
NEW

ASSIGNED

IN_PROGRESS

PENDING_CUSTOMER

PENDING_THIRD_PARTY

RESOLVED

CLOSED

REOPENED

CANCELLED


```

---

## ticket_priority_enum

```
LOW

MEDIUM

HIGH

CRITICAL


```

---

## ticket_severity_enum

```
S1

S2

S3

S4


```

---

## ticket_category_enum

```
NETWORK

BILLING

TECHNICAL

HARDWARE

SOFTWARE

OTHER


```

---

## notification_type_enum

```
TICKET_ASSIGNED

TICKET_ESCALATED

TICKET_RESOLVED

COMMENT_ADDED

SLA_WARNING

SLA_BREACHED


```

---

# 4. Tables de référence

Toutes les tables métier héritent d'un `BaseEntity` qui porte `id` (UUID v7), `created\_at`, `updated\_at`, `deleted\_at` (nullable, soft delete), `created\_by` et `updated\_by` (FK vers users) pour tout les table qui le nécessite. L'UUID est préféré à l'auto-increment pour éviter l'énumération des ressources et faciliter la réplication future.

## departments

Représente les départements de l'organisation.

### Colonnes

| Colonne <br>     | Type <br>         |
| :--------------- | :---------------- |
| id <br>          | UUIDv7 <br>       |
| name <br>        | VARCHAR(100) <br> |
| description <br> | TEXT <br>         |
| created_at <br>  | TIMESTAMP <br>    |
| updated_at <br>  | TIMESTAMP <br>    |

### Contraintes

```
UNIQUE(name)


```

### Valeurs initiales

```
ADMINISTRATION

CUSTOMER_CARE

NOC

BILLING

TECHNICAL_SUPPORT

FIELD_OPERATIONS


```

---

# 5. Gestion des utilisateurs

## users

Représente les employés utilisant la plateforme.

### Colonnes

| Colonne <br>              | Type <br>           |
| :------------------------ | :------------------ |
| id <br>                   | UUIDv7 <br>         |
| department_id <br>        | UUID <br>           |
| email <br>                | VARCHAR(255) <br>   |
| password_hash <br>        | TEXT <br>           |
| first_name <br>           | VARCHAR(100) <br>   |
| last_name <br>            | VARCHAR(100) <br>   |
| role <br>                 | role_enum <br>      |
| is_active <br>            | BOOLEAN <br>        |
| must_change_password <br> | BOOLEAN <br>        |
| last_login_at <br>        | TIMESTAMP NULL <br> |
| created_at <br>           | TIMESTAMP <br>      |
| updated_at <br>           | TIMESTAMP <br>      |
| deleted_at <br>           | TIMESTAMP NULL <br> |

### Contraintes

```
UNIQUE(email)


```

### Index

```
idx_users_email

idx_users_department

idx_users_role


```

---

# 6. Gestion des incidents

## tickets

Table principale du système.  
Chaque enregistrement représente un incident.

### Colonnes

| Colonne <br>                 | Type <br>                 |
| :--------------------------- | :------------------------ |
| id <br>                      | UUIDv7 <br>               |
| ticket_number <br>           | VARCHAR(20) <br>          |
| title <br>                   | VARCHAR(255) <br>         |
| description <br>             | TEXT <br>                 |
| status <br>                  | ticket_status_enum <br>   |
| priority <br>                | ticket_priority_enum <br> |
| severity <br>                | ticket_severity_enum <br> |
| category <br>                | ticket_category_enum <br> |
| sla_policy_id <br>           | UUID NOT NULL <br>        |
| customer_account_number <br> | VARCHAR(100) <br>         |
| customer_name <br>           | VARCHAR(255) <br>         |
| customer_contact <br>        | VARCHAR(255) <br>         |
| department_id <br>           | UUID <br>                 |
| assigned_team_id <br>        | UUID <br>                 |
| created_by <br>              | UUID <br>                 |
| assigned_to <br>             | UUID NULL <br>            |
| resolution_summary <br>      | TEXT NULL <br>            |
| first_response_at <br>       | TIMESTAMP NULL <br>       |
| first_response_due_at <br>   | TIMESTAMP <br>            |
| resolution_due_at <br>       | TIMESTAMP <br>            |
| resolved_at <br>             | TIMESTAMP NULL <br>       |
| closed_at <br>               | TIMESTAMP NULL <br>       |
| tags <br>                    | TEXT <br>                 |
| metadata <br>                | JSONB <br>                |
| created_at <br>              | TIMESTAMP <br>            |
| updated_at <br>              | TIMESTAMP <br>            |
| deleted_at <br>              | TIMESTAMP NULL <br>       |
|                              |                           |

## Numérotation des incidents

Format :

```
INC-2026-000001


```

La partie numérique est générée à l'aide d'une séquence PostgreSQL afin d'éviter les problèmes de concurrence.

---

## Contraintes

```
UNIQUE(ticket_number)


```

---

## Index

```
idx_tickets_status

idx_tickets_priority

idx_tickets_severity

idx_tickets_department

idx_tickets_assigned_team

idx_tickets_assigned_to

idx_tickets_created_by

idx_tickets_created_at


```

---

## Index spécialisés

```
GIN(tags)

GIN(metadata)


```

---

# 7. Historique des affectations

## ticket_assignments

Historise toutes les affectations.  
Un ticket ne possède qu'un seul assigné actif à un instant donné mais conserve l'historique complet de ses changements.

### Colonnes

| Colonne <br>            | Type <br>      |
| :---------------------- | :------------- |
| id <br>                 | UUIDv7 <br>    |
| ticket_id <br>          | UUID <br>      |
| from_user_id <br>       | UUID NULL <br> |
| to_user_id <br>         | UUID <br>      |
| from_department_id <br> | UUID NULL <br> |
| to_department_id <br>   | UUID <br>      |
| assigned_by <br>        | UUID <br>      |
| reason <br>             | TEXT NULL <br> |
| created_at <br>         | TIMESTAMP <br> |

# 8. Commentaires publics

## ticket_comments

Commentaires visibles dans le suivi standard du ticket.

### Colonnes

| Colonne <br>    | Type <br>      |
| :-------------- | :------------- |
| id <br>         | UUIDv7 <br>    |
| ticket_id <br>  | UUID <br>      |
| author_id <br>  | UUID <br>      |
| content <br>    | TEXT <br>      |
| created_at <br> | TIMESTAMP <br> |
| updated_at <br> | TIMESTAMP <br> |

# 9. Notes internes

## ticket_internal_notes

Informations réservées aux équipes internes.  
Ces notes ne sont jamais exposées aux utilisateurs externes.

### Colonnes

| Colonne <br>    | Type <br>      |
| :-------------- | :------------- |
| id <br>         | UUIDv7 <br>    |
| ticket_id <br>  | UUID <br>      |
| author_id <br>  | UUID <br>      |
| content <br>    | TEXT <br>      |
| created_at <br> | TIMESTAMP <br> |
| updated_at <br> | TIMESTAMP <br> |

# 10. Gestion des pièces jointes

## attachments

Cette table stocke uniquement les métadonnées des fichiers.  
Le stockage réel est délégué à un service de stockage abstrait.

### Colonnes

| Colonne <br>           | Type <br>         |
| :--------------------- | :---------------- |
| id <br>                | UUIDv7 <br>       |
| ticket_id <br>         | UUID NULL <br>    |
| comment_id <br>        | UUID NULL <br>    |
| internal_note_id <br>  | UUID NULL <br>    |
| uploaded_by <br>       | UUID <br>         |
| object_key <br>        | TEXT <br>         |
| bucket_name <br>       | VARCHAR(100) <br> |
| original_filename <br> | VARCHAR(255) <br> |
| mime_type <br>         | VARCHAR(100) <br> |
| file_size <br>         | BIGINT <br>       |
| created_at <br>        | TIMESTAMP <br>    |

## Exemple d'object_key

```
tickets/2026/06/uuidv7-report.pdf


```

---

## Avantages

Le système peut migrer vers :

- MinIO
- Amazon S3
- Azure Blob Storage

sans modification du schéma de base de données.

---

# 11. Journal d'activité

## ticket_history

Historique complet des événements métier.

### Colonnes

| Colonne <br>    | Type <br>         |
| :-------------- | :---------------- |
| id <br>         | UUIDv7 <br>       |
| ticket_id <br>  | UUID <br>         |
| user_id <br>    | UUID <br>         |
| action <br>     | VARCHAR(100) <br> |
| old_value <br>  | JSONB NULL <br>   |
| new_value <br>  | JSONB NULL <br>   |
| metadata <br>   | JSONB NULL <br>   |
| created_at <br> | TIMESTAMP <br>    |

### Exemples d'actions

```
TICKET_CREATED

ASSIGNED

REASSIGNED

ESCALATED

STATUS_CHANGED

RESOLVED

CLOSED

REOPENED


```

---

# 12. Gestion des sessions

## refresh_tokens

Stocke les refresh tokens actifs.  
Les tokens sont hachés avant stockage.

### Colonnes

| Colonne <br>    | Type <br>           |
| :-------------- | :------------------ |
| id <br>         | UUIDv7 <br>         |
| user_id <br>    | UUID <br>           |
| token_hash <br> | TEXT <br>           |
| user_agent <br> | TEXT <br>           |
| ip_address <br> | INET <br>           |
| expires_at <br> | TIMESTAMP <br>      |
| revoked_at <br> | TIMESTAMP NULL <br> |
| created_at <br> | TIMESTAMP <br>      |

# 13. Notifications

## notifications

Permet la persistance des notifications.  
Cette table constitue la source de vérité du système de notification.  
Les WebSockets servent uniquement à la diffusion temps réel.

### Colonnes

| Colonne <br>        | Type <br>                   |
| :------------------ | :-------------------------- |
| id <br>             | UUIDv7 <br>                 |
| user_id <br>        | UUID <br>                   |
| type <br>           | notification_type_enum <br> |
| title <br>          | VARCHAR(255) <br>           |
| message <br>        | TEXT <br>                   |
| reference_type <br> | VARCHAR(50) <br>            |
| reference_id <br>   | UUID <br>                   |
| is_read <br>        | BOOLEAN <br>                |
| read_at <br>        | TIMESTAMP NULL <br>         |
| created_at <br>     | TIMESTAMP <br>              |

**Architecture retenue**  
Ticket Event
│
▼
BullMQ
│
├──────── INSERT notification
│
└──────── WebSocket Emit
│
┌───────────┴───────────┐
│ │
▼ ▼
Utilisateur connecté Utilisateur absent
│ │
▼ ▼
Temps réel Notification en attente

# 14. Gestion des SLA

## sla_policies

Définit les objectifs de service.  
Le SLA dépend à la fois de la catégorie et de la priorité.

### Colonnes

| Colonne <br>                | Type <br>                 |
| :-------------------------- | :------------------------ |
| id <br>                     | UUIDv7 <br>               |
| category <br>               | ticket_category_enum <br> |
| priority <br>               | ticket_priority_enum <br> |
| first_response_minutes <br> | INTEGER <br>              |
| resolution_minutes <br>     | INTEGER <br>              |
| created_at <br>             | TIMESTAMP <br>            |
| updated_at <br>             | TIMESTAMP <br>            |

### Exemple

| Category <br> | Priority <br> | First Response <br> | Resolution <br> |
| :------------ | :------------ | :------------------ | :-------------- |
| NETWORK <br>  | CRITICAL <br> | 15 min <br>         | 120 min <br>    |
| NETWORK <br>  | HIGH <br>     | 30 min <br>         | 240 min <br>    |
| BILLING <br>  | CRITICAL <br> | 60 min <br>         | 480 min <br>    |

# 15. Gestion des audits

## audit_logs

Journal centralisé des actions administratives et métier importantes.  
Contrairement à `ticket\_history`, cette table couvre l'ensemble du système.

---

### Colonnes

| Colonne <br>     | Type <br>         |
| :--------------- | :---------------- |
| id <br>          | UUIDv7 <br>       |
| user_id <br>     | UUID <br>         |
| action <br>      | VARCHAR(100) <br> |
| entity_type <br> | VARCHAR(50) <br>  |
| entity_id <br>   | UUID <br>         |
| old_value <br>   | JSONB NULL <br>   |
| new_value <br>   | JSONB NULL <br>   |
| ip_address <br>  | INET <br>         |
| user_agent <br>  | TEXT <br>         |
| created_at <br>  | TIMESTAMP <br>    |

### Exemples d'actions

```

USER_CREATED

USER_UPDATED

USER_DEACTIVATED

ROLE_CHANGED

PASSWORD_RESET

LOGIN

LOGOUT

DEPARTMENT_CREATED

DEPARTMENT_UPDATED

SLA_CREATED

SLA_UPDATED

TICKET_REOPENED

SYSTEM_CONFIGURATION_CHANGED

```

---

### Index

```

CREATE INDEX idx_audit_logs_user
ON audit_logs(user_id);

CREATE INDEX idx_audit_logs_action
ON audit_logs(action);

CREATE INDEX idx_audit_logs_entity
ON audit_logs(entity_type, entity_id);

CREATE INDEX idx_audit_logs_created_at
ON audit_logs(created_at);

```

# 16. Relations et cardinalités

Le modèle de données repose sur des relations clairement définies afin de garantir la cohérence métier et la traçabilité des opérations.

---

## Departments ↔ Users

Un département peut contenir plusieurs utilisateurs.  
Un utilisateur appartient obligatoirement à un seul département.

```
Department (1)
      │
      └───────< Users (N)


```

---

## Departments ↔ Tickets

Un département peut être propriétaire de plusieurs tickets.  
Chaque ticket possède un département propriétaire.

```
Department (1)
      │
      └───────< Tickets (N)


```

---

## Departments ↔ Assigned Teams

Un département peut être responsable du traitement de plusieurs tickets.  
Chaque ticket possède une équipe actuellement responsable.

```
Department (1)
      │
      └───────< Tickets.assigned_team_id (N)


```

---

## Users ↔ Tickets (Création)

Un utilisateur peut créer plusieurs tickets.  
Chaque ticket possède un seul créateur.

```
User (1)
    │
    └───────< Tickets.created_by (N)


```

---

## Users ↔ Tickets (Assignation active)

Un utilisateur peut être assigné à plusieurs tickets.  
Un ticket ne possède qu'un seul assigné actif.

```
User (1)
    │
    └───────< Tickets.assigned_to (N)


```

---

## Tickets ↔ Assignments

Un ticket possède plusieurs événements d'affectation.

```
Ticket (1)
      │
      └───────< TicketAssignments (N)


```

---

## Tickets ↔ Comments

```
Ticket (1)
      │
      └───────< TicketComments (N)


```

---

## Tickets ↔ Internal Notes

```
Ticket (1)
      │
      └───────< TicketInternalNotes (N)


```

---

## Tickets ↔ Attachments

```
Ticket (1)
      │
      └───────< Attachments (N)


```

---

## Tickets ↔ History

```
Ticket (1)
      │
      └───────< TicketHistory (N)


```

---

## Users ↔ Notifications

```
User (1)
    │
    └───────< Notifications (N)


```

---

## Users ↔ Refresh Tokens

```
User (1)
    │
    └───────< RefreshTokens (N)


```

---

## Users ↔ Logs

Un utilisateur est associé à plusieurs logs . Et un log est toujours associée à un user

```

Users (1)
    │
    └───────< AuditLogs(N)

```

---

# 17. Contraintes d'intégrité

Afin de préserver la qualité des données, plusieurs contraintes sont appliquées.

---

## Unicité des utilisateurs

Chaque adresse email doit être unique.

```
UNIQUE(email)


```

---

## Unicité des tickets

Chaque incident possède un identifiant métier unique.

```
UNIQUE(ticket_number)


```

Exemple :

```
INC-2026-000001


```

---

## Départements obligatoires

Chaque utilisateur doit appartenir à un département.

```
department_id NOT NULL


```

---

## Rôles obligatoires

Chaque utilisateur doit posséder exactement un rôle.

```
role NOT NULL


```

---

## Intégrité des assignations

Chaque événement d'affectation doit référencer :

- un ticket ;
- un utilisateur cible ;
- un département cible.

```
ticket_id NOT NULL

to_user_id NOT NULL

to_department_id NOT NULL


```

---

## Intégrité des notifications

Une notification appartient toujours à un utilisateur.

```
user_id NOT NULL

```

## Intégrité des SLA

contrainte `UNIQUE(category, priority)` pour éviter les doublons

---

## Intégrité des Attachment

**contrainte CHECK** pour garantir qu'au moins un des trois est non-null ( `ticket\_id`, `comment\_id`, et `internal\_note\_id` ).

# 18. Règles métier importantes

Certaines contraintes ne peuvent pas être exprimées uniquement par SQL.  
Elles seront appliquées dans les services NestJS.

---

## Règle 1 : Un seul assigné actif

Un ticket ne peut posséder qu'un seul assigné actif.

```
✔ Autorisé

Ticket
  └── User A


✖ Interdit

Ticket
  ├── User A
  └── User B


```

---

## Règle 2 : Fermeture après résolution

Un ticket doit être résolu avant d'être clôturé.

```
NEW
 ↓
ASSIGNED
 ↓
IN_PROGRESS
 ↓
RESOLVED
 ↓
CLOSED


```

---

## Règle 3 : Réouverture limitée

Seuls certains rôles peuvent rouvrir un ticket.  
Exemple :

```
ADMINISTRATOR

SUPERVISOR


```

---

## Règle 4 : Notes internes protégées

Les notes internes ne doivent jamais être visibles hors du personnel autorisé.

---

## Règle 5 : Historisation obligatoire

Toute action importante doit produire une entrée dans :

```
ticket_history


```

---

# 19. Stratégie d'indexation

L'indexation est essentielle pour maintenir de bonnes performances lorsque le volume de tickets augmente.

---

## Index Users

```
CREATE UNIQUE INDEX idx_users_email
ON users(email);

CREATE INDEX idx_users_department
ON users(department_id);

CREATE INDEX idx_users_role
ON users(role);


```

---

## Index Tickets

```
CREATE INDEX idx_tickets_status
ON tickets(status);

CREATE INDEX idx_tickets_priority
ON tickets(priority);

CREATE INDEX idx_tickets_severity
ON tickets(severity);

CREATE INDEX idx_tickets_department
ON tickets(department_id);

CREATE INDEX idx_tickets_assigned_team
ON tickets(assigned_team_id);

CREATE INDEX idx_tickets_assigned_to
ON tickets(assigned_to);

CREATE INDEX idx_tickets_created_at
ON tickets(created_at);


```

---

## Recherche avancée sur Tags

PostgreSQL permet d'indexer les tableaux.

```
CREATE INDEX idx_tickets_tags
ON tickets
USING GIN(tags);


```

---

## Recherche avancée sur Metadata

```
CREATE INDEX idx_tickets_metadata
ON tickets
USING GIN(metadata);


```

---

## Notifications non lues

Très utilisé par le système de notification.

```
CREATE INDEX idx_notifications_unread
ON notifications(user_id, is_read);


```

---

## SLA

Les calculs de dépassement de SLA utilisent fréquemment :

```
status

priority

category


```

Un index composite pourra être ajouté :

```
CREATE INDEX idx_sla_processing
ON tickets(status, priority);


```

---

# 20. Soft Delete

Le système utilise des suppressions logiques plutôt que des suppressions physiques.

---

## Pourquoi ?

Un système de gestion d'incidents doit conserver :

- les historiques ;
- les statistiques ;
- les audits ;
- les traces d'activité.
  ***

## Implémentation

```
deleted_at TIMESTAMP NULL


```

---

## Tables concernées

```
users

tickets


```

---

## Avantages

### Audit

Aucune donnée importante n'est perdue.

### Restauration

Une suppression accidentelle peut être annulée.

### Reporting

Les statistiques historiques restent cohérentes.

---

# 21. Préparation à la montée en charge

Même si le projet est conçu comme un Modular Monolith, certaines décisions préparent l'avenir.

---

## UUIDv7

Toutes les entités utilisent UUIDv7.  
Avantages :

- tri chronologique naturel ;
- meilleures performances des index B-Tree ;
- génération distribuée.
  ***

## JSONB

Le champ :

```
metadata JSONB


```

permet l'ajout de nouveaux attributs métier sans migration systématique.

---

## Storage Service Abstrait

La table attachments ne dépend d'aucun fournisseur de stockage.  
Aujourd'hui :

```
Disque local


```

Demain :

```
MinIO

Amazon S3

Azure Blob Storage


```

sans modification du schéma.

---

## Découpage futur en microservices

Les modules :

```
Auth

Tickets

Notifications

SLA


```

possèdent déjà des frontières métier claires.  
Une migration vers des microservices serait donc possible sans refonte complète.

---

# 22. Diagramme ERD (Source officielle)

Le diagramme ERD principal sera maintenu dans :

```
dbdiagram.io


```

Le dépôt GitHub contiendra database.dbml :

```
Enum role_enum {
ADMINISTRATOR
SUPERVISOR
CUSTOMER_SERVICE_AGENT
NOC_ENGINEER
BILLING_AGENT
TECHNICAL_SUPPORT_ENGINEER
FIELD_TECHNICIAN
}
Enum ticket_status_enum {
NEW
ASSIGNED
IN_PROGRESS
PENDING_CUSTOMER
PENDING_THIRD_PARTY
RESOLVED
CLOSED
REOPENED
CANCELLED
}
Enum ticket_priority_enum {
LOW
MEDIUM
HIGH
CRITICAL
}
Enum ticket_severity_enum {
S1
S2
S3
S4
}
Enum ticket_category_enum {
NETWORK
BILLING
TECHNICAL
HARDWARE
SOFTWARE
OTHER
}
Enum notification_type_enum {
TICKET_ASSIGNED
TICKET_ESCALATED
TICKET_RESOLVED
COMMENT_ADDED
SLA_WARNING
SLA_BREACHED
}

Table departments {
id uuid [pk]
name varchar(100) [unique, not null]
description text
created_at timestamp
updated_at timestamp
}
Table users {
id uuid [pk]
department_id uuid [not null, ref: > departments.id]
email varchar(255) [unique, not null]
password_hash text [not null]
first_name varchar(100) [not null]
last_name varchar(100) [not null]
role role_enum
is_active boolean [default: true]
must_change_password boolean [default: false]
last_login_at timestamp
created_at timestamp
updated_at timestamp
deleted_at timestamp
}
Table tickets {
id uuid [pk]
ticket_number varchar(30) [unique, not null]
title varchar(255) [not null]
description text [not null]
status ticket_status_enum
priority ticket_priority_enum
severity ticket_severity_enum
category ticket_category_enum
sla_policy_id uuid [not null, ref: > sla_policies.id]
customer_account_number varchar(100)
customer_name varchar(255)
customer_contact varchar(255)
department_id uuid [not null, ref: > departments.id]
assigned_team_id uuid [not null, ref: > departments.id]
created_by uuid [not null, ref: > users.id]
assigned_to uuid [ref: > users.id]
resolution_summary text
first_response_at timestamp
resolved_at timestamp
first_response_due_at timestamp
resolution_due_at timestamp
closed_at timestamp
tags text
metadata json
created_at timestamp
updated_at timestamp
deleted_at timestamp
}
Table ticket_assignments {
id uuid [pk]
ticket_id uuid [not null, ref: > tickets.id]
from_user_id uuid [ref: > users.id]
to_user_id uuid [not null, ref: > users.id]
from_department_id uuid [ref: > departments.id]
to_department_id uuid [not null, ref: > departments.id]
assigned_by uuid [not null, ref: > users.id]
reason text
created_at timestamp
}
Table ticket_comments {
id uuid [pk]
ticket_id uuid [not null, ref: > tickets.id]
author_id uuid [not null, ref: > users.id]
content text [not null]
created_at timestamp
updated_at timestamp
}
Table ticket_internal_notes {
id uuid [pk]
ticket_id uuid [not null, ref: > tickets.id]
author_id uuid [not null, ref: > users.id]
content text [not null]
created_at timestamp
updated_at timestamp
}
Table attachments {
id uuid [pk]
ticket_id uuid [ref: > tickets.id]
comment_id uuid [ref: > ticket_comments.id]
internal_note_id uuid [ref: > ticket_internal_notes.id]
uploaded_by uuid [not null, ref: > users.id]
object_key text [not null]
bucket_name varchar(100)
original_filename varchar(255)
mime_type varchar(100)
file_size bigint
created_at timestamp
}
Table ticket_history {
id uuid [pk]
ticket_id uuid [not null, ref: > tickets.id]
user_id uuid [not null, ref: > users.id]
action varchar(100) [not null]
old_value json
new_value json
metadata json
created_at timestamp
}
Table refresh_tokens {
id uuid [pk]
user_id uuid [not null, ref: > users.id]
token_hash text [not null]
user_agent text
ip_address varchar(45)
expires_at timestamp [not null]
revoked_at timestamp
created_at timestamp
}
Table notifications {
id uuid [pk]
user_id uuid [not null, ref: > users.id]
type notification_type_enum
title varchar(255) [not null]
message text [not null]
reference_type varchar(50)
reference_id uuid
is_read boolean [default: false]
read_at timestamp
created_at timestamp
}
Table sla_policies {
id uuid [pk]
category ticket_category_enum
priority ticket_priority_enum
first_response_minutes int [not null]
resolution_minutes int [not null]
created_at timestamp
updated_at timestamp
}
Table audit_logs {
id uuid [pk]
user_id uuid [not null, ref: > users.id]
action varchar(100) [not null]
entity_type varchar(50) [not null]
entity_id uuid [not null]
old_value json
new_value json
ip_address varchar(45)
user_agent text
created_at timestamp
}



```

comme source de vérité du schéma.

---

# 23. Diagramme Mermaid

Une version simplifiée sera également fournie dans la documentation technique afin de faciliter la lecture rapide de l'architecture.

### Mermaid ERD

Version pour README et documentation.

erDiagram

```
DEPARTMENTS ||--o{ USERS : contains

DEPARTMENTS ||--o{ TICKETS : owns

DEPARTMENTS ||--o{ TICKETS : assigned_team

USERS ||--o{ TICKETS : creates

USERS ||--o{ TICKETS : assigned_to

USERS ||--o{ TICKET_COMMENTS : writes

USERS ||--o{ TICKET_INTERNAL_NOTES : writes

USERS ||--o{ ATTACHMENTS : uploads

USERS ||--o{ NOTIFICATIONS : receives

USERS ||--o{ REFRESH_TOKENS : owns

USERS ||--o{ AUDIT_LOGS : performs

USERS ||--o{ TICKET_HISTORY : performs

TICKETS ||--o{ TICKET_ASSIGNMENTS : assignment_history

TICKETS ||--o{ TICKET_COMMENTS : contains

TICKETS ||--o{ TICKET_INTERNAL_NOTES : contains

TICKETS ||--o{ ATTACHMENTS : contains

TICKETS ||--o{ TICKET_HISTORY : tracks

TICKET_COMMENTS ||--o{ ATTACHMENTS : contains

TICKET_INTERNAL_NOTES ||--o{ ATTACHMENTS : contains

```

# Mermaid ERD

Version simplifiée pour README , documentation et les présentations techniques.

flowchart LR

```
D[Departments]

U[Users]

T[Tickets]

TA[Ticket Assignments]

TC[Ticket Comments]

TN[Internal Notes]

TH[Ticket History]

AT[Attachments]

RT[Refresh Tokens]

NT[Notifications]

SLA[SLA Policies]

AL[Audit Logs]

D --> U

D --> T

U --> T

T --> TA

T --> TC

T --> TN

T --> TH

T --> AT

U --> RT

U --> NT

U --> AL

SLA --> T

```

Cette représentation sera utilisée :

- dans le README ;
- dans la documentation du projet ;
- dans les présentations techniques.
  ***

# 24. Matrice RBAC finale

| Action <br>               | Agent <br>   | NOC <br>     | Billing <br> | Support <br> | Field <br>   | Supervisor <br> | Admin <br> |
| :------------------------ | :----------- | :----------- | :----------- | :----------- | :----------- | :-------------- | :--------- |
| Créer ticket <br>         | ✅ <br>      | ✅ <br>      | ✅ <br>      | ✅ <br>      | ✅ <br>      | ✅ <br>         | ✅ <br>    |
| Modifier ticket <br>      | Assigné <br> | Assigné <br> | Assigné <br> | Assigné <br> | Assigné <br> | ✅ <br>         | ✅ <br>    |
| Assigner ticket <br>      | ❌ <br>      | ❌ <br>      | ❌ <br>      | ❌ <br>      | ❌ <br>      | ✅ <br>         | ✅ <br>    |
| Réassigner ticket <br>    | ❌ <br>      | ❌ <br>      | ❌ <br>      | ❌ <br>      | ❌ <br>      | ✅ <br>         | ✅ <br>    |
| Escalader ticket <br>     | ❌ <br>      | ❌ <br>      | ❌ <br>      | ❌ <br>      | ❌ <br>      | ✅ <br>         | ✅ <br>    |
| Résoudre ticket <br>      | ✅ <br>      | ✅ <br>      | ✅ <br>      | ✅ <br>      | ✅ <br>      | ✅ <br>         | ✅ <br>    |
| Clôturer ticket <br>      | ❌ <br>      | ❌ <br>      | ❌ <br>      | ❌ <br>      | ❌ <br>      | ✅ <br>         | ✅ <br>    |
| Réouvrir ticket <br>      | ❌ <br>      | ❌ <br>      | ❌ <br>      | ❌ <br>      | ❌ <br>      | ✅ <br>         | ✅ <br>    |
| Notes internes <br>       | ✅ <br>      | ✅ <br>      | ✅ <br>      | ✅ <br>      | ❌ <br>      | ✅ <br>         | ✅ <br>    |
| Audit Logs <br>           | ❌ <br>      | ❌ <br>      | ❌ <br>      | ❌ <br>      | ❌ <br>      | ✅ <br>         | ✅ <br>    |
| Gestion utilisateurs <br> | ❌ <br>      | ❌ <br>      | ❌ <br>      | ❌ <br>      | ❌ <br>      | Partielle <br>  | ✅ <br>    |
| Gestion SLA <br>          | ❌ <br>      | ❌ <br>      | ❌ <br>      | ❌ <br>      | ❌ <br>      | ✅ <br>         | ✅ <br>    |

# 25. Conclusion

Le modèle de données proposé répond aux exigences d'une plateforme de gestion d'incidents télécoms moderne.  
Les principales caractéristiques de cette conception sont :

- intégrité référentielle forte ;
- historisation complète des opérations ;
- séparation claire des responsabilités ;
- support des SLA ;
- gestion robuste des notifications ;
- préparation à la montée en charge ;
- indépendance vis-à-vis du système de stockage des fichiers.

Grâce à PostgreSQL, aux ENUM, aux index spécialisés GIN, aux UUIDv7 et à l'utilisation de JSONB, cette base de données constitue une fondation solide pour les phases d'implémentation et d'exploitation du système.
