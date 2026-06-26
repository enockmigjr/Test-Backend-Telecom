---
# yaml-language-server: $schema=schemas\page.schema.json
Object type:
    - Page
Creation date: "2026-06-22T09:40:37Z"
Created by:
    - Enock Junior
id: bafyreighdmzh53atn7mphuobvdajxmz2a5lbykn5wflxfzyhvdpemnqkde
---
# DBML (dbdiagram.io) et Mermaid ERD   
# DBML (dbdiagram.io)   
   
Enum role\_enum {
ADMINISTRATOR
SUPERVISOR
CUSTOMER\_SERVICE\_AGENT
NOC\_ENGINEER
BILLING\_AGENT
TECHNICAL\_SUPPORT\_ENGINEER
FIELD\_TECHNICIAN
}   
Enum ticket\_status\_enum {
NEW
ASSIGNED
IN\_PROGRESS
PENDING\_CUSTOMER
PENDING\_THIRD\_PARTY
RESOLVED
CLOSED
REOPENED
CANCELLED
}   
Enum ticket\_priority\_enum {
LOW
MEDIUM
HIGH
CRITICAL
}   
Enum ticket\_severity\_enum {
S1
S2
S3
S4
}   
Enum ticket\_category\_enum {
NETWORK
BILLING
TECHNICAL
HARDWARE
SOFTWARE
OTHER
}   
Enum notification\_type\_enum {
TICKET\_ASSIGNED
TICKET\_ESCALATED
TICKET\_RESOLVED
COMMENT\_ADDED
SLA\_WARNING
SLA\_BREACHED
}   
   
Table departments {
id uuid [pk]
name varchar(100) [unique, not null]
description text
created\_at timestamp
updated\_at timestamp
}   
Table users {
id uuid [pk]   
department\_id uuid [not null, ref: > departments.id]   
email varchar(255) [unique, not null]
password\_hash text [not null]   
first\_name varchar(100) [not null]
last\_name varchar(100) [not null]   
role role\_enum   
is\_active boolean [default: true]
must\_change\_password boolean [default: false]   
last\_login\_at timestamp   
created\_at timestamp
updated\_at timestamp
deleted\_at timestamp
}   
Table tickets {
id uuid [pk]   
ticket\_number varchar(30) [unique, not null]   
title varchar(255) [not null]
description text [not null]   
status ticket\_status\_enum
priority ticket\_priority\_enum
severity ticket\_severity\_enum
category ticket\_category\_enum   
sla\_policy\_id uuid [not null, ref: > sla\_policies.id]   
customer\_account\_number varchar(100)
customer\_name varchar(255)
customer\_contact varchar(255)   
department\_id uuid [not null, ref: > departments.id]   
assigned\_team\_id uuid [not null, ref: > departments.id]   
created\_by uuid [not null, ref: > users.id]   
assigned\_to uuid [ref: > users.id]   
resolution\_summary text   
first\_response\_at timestamp
resolved\_at timestamp   
first\_response\_due\_at timestamp
resolution\_due\_at timestamp
closed\_at timestamp   
tags text   
metadata json   
created\_at timestamp
updated\_at timestamp
deleted\_at timestamp
}   
Table ticket\_assignments {
id uuid [pk]   
ticket\_id uuid [not null, ref: > tickets.id]   
from\_user\_id uuid [ref: > users.id]
to\_user\_id uuid [not null, ref: > users.id]   
from\_department\_id uuid [ref: > departments.id]
to\_department\_id uuid [not null, ref: > departments.id]   
assigned\_by uuid [not null, ref: > users.id]   
reason text   
created\_at timestamp
}   
Table ticket\_comments {
id uuid [pk]   
ticket\_id uuid [not null, ref: > tickets.id]   
author\_id uuid [not null, ref: > users.id]   
content text [not null]   
created\_at timestamp
updated\_at timestamp
}   
Table ticket\_internal\_notes {
id uuid [pk]   
ticket\_id uuid [not null, ref: > tickets.id]   
author\_id uuid [not null, ref: > users.id]   
content text [not null]   
created\_at timestamp
updated\_at timestamp
}   
Table attachments {
id uuid [pk]   
ticket\_id uuid [ref: > tickets.id]   
comment\_id uuid [ref: > ticket\_comments.id]   
internal\_note\_id uuid [ref: > ticket\_internal\_notes.id]   
uploaded\_by uuid [not null, ref: > users.id]   
object\_key text [not null]   
bucket\_name varchar(100)   
original\_filename varchar(255)   
mime\_type varchar(100)   
file\_size bigint   
created\_at timestamp
}   
Table ticket\_history {
id uuid [pk]   
ticket\_id uuid [not null, ref: > tickets.id]   
user\_id uuid [not null, ref: > users.id]   
action varchar(100) [not null]   
old\_value json
new\_value json   
metadata json   
created\_at timestamp
}   
Table refresh\_tokens {
id uuid [pk]   
user\_id uuid [not null, ref: > users.id]   
token\_hash text [not null]   
user\_agent text   
ip\_address varchar(45)   
expires\_at timestamp [not null]   
revoked\_at timestamp   
created\_at timestamp
}   
Table notifications {
id uuid [pk]   
user\_id uuid [not null, ref: > users.id]   
type notification\_type\_enum   
title varchar(255) [not null]   
message text [not null]   
reference\_type varchar(50)   
reference\_id uuid   
is\_read boolean [default: false]   
read\_at timestamp   
created\_at timestamp
}   
Table sla\_policies {   
id uuid [pk]   
category ticket\_category\_enum   
priority ticket\_priority\_enum   
first\_response\_minutes int [not null]   
resolution\_minutes int [not null]   
created\_at timestamp
updated\_at timestamp
}   
Table audit\_logs {
id uuid [pk]   
user\_id uuid [not null, ref: > users.id]   
action varchar(100) [not null]   
entity\_type varchar(50) [not null]   
entity\_id uuid [not null]   
old\_value json   
new\_value json   
ip\_address varchar(45)   
user\_agent text   
created\_at timestamp
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
API->>DB: Update assigned\_to   
API->>DB: Insert ticket\_assignment   
API->>DB: Insert ticket\_history   
API->>DB: Insert audit\_log   
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
