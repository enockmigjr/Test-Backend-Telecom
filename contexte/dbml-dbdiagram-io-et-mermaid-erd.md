---
# yaml-language-server: $schema=schemas\page.schema.json
Object type:
  - Page
Creation date: '2026-06-22T09:40:37Z'
Created by:
  - Enock Junior
id: bafyreighdmzh53atn7mphuobvdajxmz2a5lbykn5wflxfzyhvdpemnqkde
---

# DBML (dbdiagram.io) et Mermaid ERD

# DBML (dbdiagram.io)

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
sla_policy_id uuid [not null, ref: > sla\_policies.id]  
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
comment_id uuid [ref: > ticket\_comments.id]  
internal_note_id uuid [ref: > ticket\_internal\_notes.id]  
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

# Mermaid ERD

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

Version simplifiée pour README et documentation.

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

## Diagramme de Sécurité

flowchart LR

```
Client

Nginx

Helmet

Guards

Validation

Controllers

Client --> Nginx

Nginx --> Helmet

Helmet --> Guards

Guards --> Validation

Validation --> Controllers

```

## Diagramme de Déploiement

flowchart TB

```
Internet

Nginx

NestJS

Workers

PostgreSQL

Redis

Grafana

Internet --> Nginx

Nginx --> NestJS

NestJS --> PostgreSQL

NestJS --> Redis

Workers --> Redis

Workers --> PostgreSQL

Grafana --> PostgreSQL

Grafana --> Redis

```

## Diagramme d'Observabilité

flowchart LR

```
NestJS

Pino

Loki

OpenTelemetry

Tempo

Prometheus

Grafana

NestJS --> Pino

Pino --> Loki

NestJS --> OpenTelemetry

OpenTelemetry --> Tempo

NestJS --> Prometheus

Grafana --> Loki

Grafana --> Tempo

Grafana --> Prometheus

```

## Diagramme Upload de Fichier

sequenceDiagram  
participant User  
participant API  
participant Storage  
participant DB  
User->>API: Upload File  
API->>API: Validate MIME  
API->>API: Antivirus Scan  
API->>Storage: Store File  
API->>DB: Save Metadata  
API⟶>User: Success

## Diagramme Refresh Token Rotation

sequenceDiagram  
participant User  
participant API  
participant DB  
User->>API: Refresh Token  
API->>DB: Verify Token  
API->>DB: Revoke Old Token  
API->>DB: Store New Token  
API⟶>User: New Tokens

## Diagramme Authentification

sequenceDiagram  
participant User  
participant API  
participant DB  
User->>API: Login  
API->>DB: Verify User  
API->>DB: Verify Argon2id  
API->>DB: Store Refresh Token  
API⟶>User: Access + Refresh

## Diagramme Notifications

flowchart LR

```
Event[Business Event]

DB[(Notifications Table)]

WS[WebSocket]

User

Event --> DB

Event --> WS

DB --> User

WS --> User

```

## Diagramme SLA

flowchart LR

```
Ticket

SLA[SLA Policy]

Queue[BullMQ SLA Queue]

Notification

Ticket --> SLA

SLA --> Queue

Queue --> Notification

```

## Diagramme de Résolution d'un Ticket

sequenceDiagram  
participant Engineer  
participant API  
participant DB  
participant Queue  
Engineer->>API: Resolve Ticket  
API->>DB: Update status  
API->>DB: Insert History  
API->>DB: Insert Audit  
API->>Queue: Notification  
API⟶>Engineer: Success

## Diagramme d'Affectation d'un Ticket

sequenceDiagram  
participant Supervisor  
participant API  
participant DB  
participant Queue  
participant AssignedUser  
Supervisor->>API: Assign Ticket  
API->>DB: Update assigned_to  
API->>DB: Insert ticket_assignment  
API->>DB: Insert ticket_history  
API->>DB: Insert audit_log  
API->>Queue: Notification Job  
Queue⟶>AssignedUser: New Assignment

## Diagramme de Création d'un Ticket

sequenceDiagram  
participant User  
participant API  
participant PostgreSQL  
participant BullMQ  
participant WS  
User->>API: POST /tickets  
API->>PostgreSQL: Create Ticket  
API->>PostgreSQL: Create Ticket History  
API->>PostgreSQL: Create Audit Log  
API->>BullMQ: Notification Job  
API->>BullMQ: SLA Job  
API->>WS: ticket.created  
API⟶>User: 201 Created

## Architecture Applicative Interne

flowchart TB

```
Controller

Service

Repository

PostgreSQL

BullMQ

WebSocket

Controller --> Service

Service --> Repository

Repository --> PostgreSQL

Service --> BullMQ

Service --> WebSocket

```

## Vue d'ensemble de l'architecture (C4 - Level 1)

flowchart LR

```
Employee[Employé Telecom]

System[Incident Management Platform]

Mail[Email Service]

Employee --> System

System --> Mail

```

## Architecture Conteneurs (C4 - Level 2)

flowchart LR

```
User[Web Frontend]

Nginx[Nginx Reverse Proxy]

API[NestJS API]

Worker[BullMQ Workers]

PG[(PostgreSQL)]

Redis[(Redis)]

User --> Nginx

Nginx --> API

API --> PG

API --> Redis

Worker --> Redis

Worker --> PG

```
