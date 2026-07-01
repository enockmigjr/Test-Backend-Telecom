---
# yaml-language-server: $schema=schemas\page.schema.json
Object type:
  - Page
Creation date: '2026-06-22T11:37:43Z'
Created by:
  - Enock Junior
id: bafyreidpm32w63ipwnutufcxtsiekyebtfuzkv4bjvrtqp3kaqgjbmmxtm
---

# Phase 3 – API Design & Implementation Strategy

# 1. Introduction

Cette phase décrit la stratégie d'implémentation du backend de la plateforme de gestion d'incidents télécoms.  
L'objectif est de garantir :

- une API cohérente ;
- une architecture NestJS maintenable ;
- une sécurité robuste ;
- une évolutivité future ;
- une bonne expérience développeur.
  ***

# 2. Principes de conception de l'API

L'API suit les principes REST.

## Versionnement

Toutes les routes sont versionnées.

```
/api/v1


```

Exemples :

```
/api/v1/auth/login

/api/v1/users

/api/v1/tickets


```

---

## Convention de nommage

Utilisation systématique :

```
noms pluriels

kebab-case

ressources REST


```

Exemples :

```
GET /tickets

POST /tickets

PATCH /tickets/:id

DELETE /tickets/:id


```

---

## Format JSON

Toutes les requêtes et réponses utilisent :

```
Content-Type: application/json


```

---

# 3. Format standard des réponses

Afin d'assurer la cohérence de l'API, toutes les réponses suivent la même structure.

---

## Succès

```
{
  "success": true,
  "message": "Ticket created successfully",
  "data": {}
}


```

---

## Erreur

```
{
  "success": false,
  "message": "Un ou plusieurs champs de la requête sont invalides.",
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Un ou plusieurs champs de la requête sont invalides.",
    "details": {
      "title": "Le titre est requis et doit comporter au moins 5 caractères.",
      "priority": "La priorité doit être 'LOW', 'MEDIUM' ou 'HIGH'.",
      "departmentId": "L'identifiant du département doit être un UUID valide."
    },
    "correlationId": "b2c3d4e5-f6a7-8901-bcde-f23456789012",
    "timestamp": "2026-06-22T14:35:20.789Z"
  }
}


```

---

## Pagination

```
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 250,
    "totalPages": 13
  }
}


```

---

# 4. Authentification

L'application utilise :

```
JWT Access Token

Refresh Token Rotation


```

---

## Flux d'authentification

```
Login
  │
  ▼
Access Token (15 min)

Refresh Token (7 jours)

  │
  ▼

Refresh Endpoint

  │
  ▼

Nouveau couple de tokens


```

---

#

## 5. Routes d'authentification

### Login

```
POST /api/v1/auth/login — Public. Body : { email, password }. Vérifie les identifiants et crée une session. Réponse : { accessToken, refreshToken, user: { id, email, role, department } }. Erreurs : 401 (identifiants invalides), 403 (compte désactivé), 429 (trop de tentatives).


```

Request :

```
{
  "email": "agent@telecom.com",
  "password": "********"
}


```

### Refresh

```
POST /api/v1/auth/refresh — Public. Body : { refreshToken }. Effectue une rotation du refresh token. Réponse : { accessToken, refreshToken }. Erreurs : 401 (token expiré, invalide ou révoqué).


```

### Logout

```
POST /api/v1/auth/logout — Authentifié. Body : { refreshToken }. Révoque le refresh token fourni. Réponse : 204 No Content. Erreurs : 401 si non authentifié.

POST /api/v1/auth/logout-all — Authentifié. Révoque toutes les sessions actives de l'utilisateur. Réponse : 204 No Content.


```

### Me

```
GET /api/v1/users/me (profil de l'utilisateur connecté). Réponse : 200 OK. Erreurs : 429 si abus.

```

### Change Password

```
PUT /api/v1/auth/change-password — Authentifié. Body : { currentPassword, newPassword }. Modifie le mot de passe de l'utilisateur connecté. Réponse : 200 OK. Erreurs : 400 (mot de passe invalide), 401 (mot de passe actuel incorrect).


```

---

## 6. Autorisation

NestJS Guards sont utilisés pour contrôler les accès.

### JwtAuthGuard

Responsable de :

```
Validation JWT

Authentification

Injection de l'utilisateur courant dans la requête


```

### RolesGuard

Responsable de :

```
Contrôle des rôles

Vérification des permissions métier


```

Exemple :

```
@Roles('ADMINISTRATOR')


```

### DepartmentGuard

Responsable de :

```
Restrictions départementales

Isolation des données métier

Contrôle d'accès aux tickets et opérations d'un département


```

Exemple :

```
NOC

Billing

Customer Care


```

---

## 7. Gestion des utilisateurs

### Liste

```
GET /api/v1/users — ADMINISTRATOR, SUPERVISOR. Retourne les utilisateurs avec pagination, recherche et filtres. Réponse : liste paginée. Erreurs : 401, 403.


```

### Détail

```
GET /api/v1/users/:id — ADMINISTRATOR, SUPERVISOR ou utilisateur concerné. Retourne les informations d'un utilisateur. Réponse : UserDetails. Erreurs : 404, 403.


```

### Création

```
POST /api/v1/users — ADMINISTRATOR uniquement. Crée un utilisateur et génère un mot de passe temporaire. Réponse : UserCreated. Erreurs : 400, 409 (email déjà utilisé).


```

### Modification

```
PATCH /api/v1/users/:id — ADMINISTRATOR ou SUPERVISOR selon périmètre. Met à jour les informations utilisateur. Réponse : UserUpdated. Erreurs : 400, 403, 404.


```

### Désactivation

```
PATCH /api/v1/users/:id/deactivate — ADMINISTRATOR uniquement. Désactive un compte utilisateur. Réponse : 200 OK. Erreurs : 403, 404.


```

### Réactivation

```
PATCH /api/v1/users/:id/activate — ADMINISTRATOR uniquement. Réactive un compte utilisateur. Réponse : 200 OK. Erreurs : 403, 404.


```

---

## 8. Gestion des départements

### Liste

```
GET /api/v1/departments — Tout utilisateur authentifié. Retourne les départements disponibles. Réponse : liste des départements.


```

### Création

```
POST /api/v1/departments — ADMINISTRATOR uniquement. Crée un département. Réponse : DepartmentCreated. Erreurs : 400, 409.


```

### Modification

```
PATCH /api/v1/departments/:id — ADMINISTRATOR uniquement. Modifie un département. Réponse : DepartmentUpdated. Erreurs : 400, 404.


```

### Suppression

```
DELETE /api/v1/departments/:id — ADMINISTRATOR uniquement. Suppression logique uniquement si aucun utilisateur ou ticket actif n'est lié. Réponse : 204 No Content. Erreurs : 409, 404.


```

---

## 9. Gestion des tickets

### Création

```
POST /api/v1/tickets — CUSTOMER_SERVICE_AGENT, NOC_ENGINEER, BILLING_AGENT, TECHNICAL_SUPPORT_ENGINEER, FIELD_TECHNICIAN, SUPERVISOR, ADMINISTRATOR. Crée un incident. Réponse : TicketCreated. Erreurs : 400, 403.


```

### Liste

```
GET /api/v1/tickets — Utilisateur authentifié. Retourne les tickets visibles selon rôle et département. Réponse : liste paginée. Erreurs : 401.
GET /api/v1/tickets/search  pour la recherche


```

Filtres :

```
?status=
?priority=
?category=
?assignedTo=
?assignedTeam=


```

### Détail

```
GET /api/v1/tickets/:id — Utilisateur autorisé sur le ticket. Retourne les détails complets du ticket. Réponse : TicketDetails. Erreurs : 403, 404.


```

### Modification

```
PATCH /api/v1/tickets/:id — Assigné du ticket, SUPERVISOR ou ADMINISTRATOR. Met à jour les informations du ticket. Réponse : TicketUpdated. Erreurs : 400, 403, 404.


```

### Assignation

```
POST /api/v1/tickets/:id/assign — SUPERVISOR, ADMINISTRATOR. Assigne le ticket à un agent. Crée un historique d'affectation. Réponse : TicketAssigned. Erreurs : 400, 403, 404.


```

Request :

```
{
  "userId": "uuid"
}


```

### Réassignation

```
POST /api/v1/tickets/:id/reassign — SUPERVISOR, ADMINISTRATOR. Change l'assigné actif du ticket. Réponse : TicketReassigned. Erreurs : 400, 403, 404.


```

### Escalade

```
POST /api/v1/tickets/:id/escalate — SUPERVISOR, ADMINISTRATOR. Escalade le ticket vers une autre équipe ou priorité. Réponse : TicketEscalated. Erreurs : 400, 403.


```

### Résolution

```
POST /api/v1/tickets/:id/resolve — Assigné du ticket, SUPERVISOR, ADMINISTRATOR. Marque le ticket comme résolu. Réponse : TicketResolved. Erreurs : 400, 403.


```

### Clôture

```
POST /api/v1/tickets/:id/close — SUPERVISOR, ADMINISTRATOR. Clôture un ticket résolu. Réponse : TicketClosed. Erreurs : 400 (non résolu), 403.


```

### Réouverture

```
POST /api/v1/tickets/:id/reopen — SUPERVISOR, ADMINISTRATOR. Réouvre un ticket clôturé. Réponse : TicketReopened. Erreurs : 400, 403.


```

### Ticket History

```
GET /api/v1/tickets/:id/history — Utilisateur autorisé sur le ticket. Retourne l'historique complet des actions. Réponse : liste chronologique des événements. Erreurs : 403, 404.


```

### Suppression

```
DELETE /api/v1/tickets/:id — ADMINISTRATOR uniquement. Suppression logique (soft delete). Réponse : 204 No Content. Erreurs : 403, 404.


```

---

## 10. Commentaires publics

### Ajouter

```
POST /api/v1/tickets/:id/comments — Utilisateur autorisé sur le ticket. Ajoute un commentaire public. Réponse : CommentCreated. Erreurs : 403, 404.


```

### Liste

```
GET /api/v1/tickets/:id/comments — Utilisateur autorisé sur le ticket. Retourne les commentaires publics. Réponse : liste paginée.


```

### Modification

```
PATCH /api/v1/comments/:id — Auteur, SUPERVISOR ou ADMINISTRATOR. Modifie un commentaire. Réponse : CommentUpdated. Erreurs : 403, 404.


```

### Suppression

```
DELETE /api/v1/comments/:id — Auteur, SUPERVISOR ou ADMINISTRATOR. Suppression logique. Réponse : 204 No Content. Erreurs : 403, 404.


```

---

## 11. Notes internes

### Ajouter

```
POST /api/v1/tickets/:id/internal-notes — Employés internes uniquement. Ajoute une note interne. Réponse : InternalNoteCreated. Erreurs : 403, 404.


```

### Liste

```
GET /api/v1/tickets/:id/internal-notes — Employés internes autorisés. Retourne les notes internes. Réponse : liste paginée. Erreurs : 403.


```

### Modification

```
PATCH /api/v1/internal-notes/:id — Auteur, SUPERVISOR ou ADMINISTRATOR. Réponse : InternalNoteUpdated. Erreurs : 403, 404.


```

### Suppression

```
DELETE /api/v1/internal-notes/:id — Auteur, SUPERVISOR ou ADMINISTRATOR. Réponse : 204 No Content. Erreurs : 403, 404.


```

---

## 12. Pièces jointes

### Upload

```
POST /api/v1/attachments — Utilisateur autorisé sur la ressource cible. multipart/form-data. Upload et association à un ticket, commentaire ou note interne. Réponse : AttachmentCreated. Erreurs : 400, 413, 415.


```

### Téléchargement

```
GET /api/v1/attachments/:id/download — Utilisateur autorisé. Retourne le fichier ou une URL signée. Erreurs : 403, 404.


```

### Suppression

```
DELETE /api/v1/attachments/:id — Uploader, SUPERVISOR ou ADMINISTRATOR. Réponse : 204 No Content. Erreurs : 403, 404.


```

---

## 13. Notifications

### Liste

```
GET /api/v1/notifications — Utilisateur connecté. Retourne ses notifications. Réponse : liste paginée.


```

### Non lues

```
GET /api/v1/notifications/unread — Utilisateur connecté. Retourne uniquement les notifications non lues.


```

### Marquer comme lue

```
PATCH /api/v1/notifications/:id/read — Propriétaire de la notification. Réponse : NotificationUpdated. Erreurs : 403, 404.


```

### Tout marquer comme lu

```
PATCH /api/v1/notifications/read-all — Utilisateur connecté. Marque toutes ses notifications comme lues. Réponse : 200 OK.


```

---

## 14. Audit Logs

Réservé :

```
ADMINISTRATOR

SUPERVISOR


```

### Liste

```
GET /api/v1/audit-logs — ADMINISTRATOR, SUPERVISOR. Consultation des actions administratives et métier. Filtres : utilisateur, action, période. Réponse : liste paginée.


```

### Détail

```
GET /api/v1/audit-logs/:id — ADMINISTRATOR, SUPERVISOR. Retourne le détail complet d'un événement d'audit. Réponse : AuditLogDetails. Erreurs : 404.


```

---

## 15. SLA

### Liste

```
GET /api/v1/sla-policies — Tout utilisateur authentifié. Retourne les politiques SLA configurées.


```

### Création

```
POST /api/v1/sla-policies — ADMINISTRATOR uniquement. Crée une politique SLA. Réponse : SLAPolicyCreated. Erreurs : 400, 409.


```

### Modification

```
PATCH /api/v1/sla-policies/:id — ADMINISTRATOR uniquement. Modifie une politique SLA. Réponse : SLAPolicyUpdated. Erreurs : 400, 404.


```

---

## 16. Dashboard

### KPIs globaux

```
GET /api/v1/dashboard/overview — SUPERVISOR, ADMINISTRATOR. Retourne les indicateurs globaux de la plateforme. Réponse : { openTickets, criticalTickets, slaBreaches, resolvedToday, averageResolutionTime }.


```

Retour :

```
{
  "openTickets": 42,
  "criticalTickets": 7,
  "slaBreaches": 3
}


```

### Performance par département

```
GET /api/v1/dashboard/departments — SUPERVISOR, ADMINISTRATOR. Retourne les métriques agrégées par département. Réponse : statistiques par équipe.


```

### Charge des agents

```
GET /api/v1/dashboard/workload — SUPERVISOR, ADMINISTRATOR,. Retourne la répartition des tickets par agent et leur charge actuelle. Réponse : workload par utilisateur.




```

---

Voilà les endpoints dashboard complétés et détaillés :

---

## 16. Dashboard — Spécification Complète

---

### KPIs Globaux

```
GET /api/v1/dashboard/overview
Authorization: SUPERVISOR, ADMINISTRATOR


```

**Query params :**

```
?from=2026-01-01T00:00:00Z   (optionnel, défaut: début du mois)
?to=2026-06-23T23:59:59Z     (optionnel, défaut: maintenant)


```

**Réponse 200 :**

```
{
  "period": {
    "from": "2026-06-01T00:00:00Z",
    "to": "2026-06-23T23:59:59Z"
  },
  "ticketVolume": {
    "total": 318,
    "openTickets": 42,
    "resolvedToday": 11,
    "createdToday": 15,
    "closedToday": 9
  },
  "byStatus": {
    "NEW": 8,
    "ASSIGNED": 12,
    "IN_PROGRESS": 22,
    "PENDING_CUSTOMER": 5,
    "PENDING_THIRD_PARTY": 3,
    "RESOLVED": 210,
    "CLOSED": 50,
    "REOPENED": 4,
    "CANCELLED": 4
  },
  "byPriority": {
    "CRITICAL": 7,
    "HIGH": 18,
    "MEDIUM": 30,
    "LOW": 7
  },
  "bySeverity": {
    "S1": 3,
    "S2": 9,
    "S3": 20,
    "S4": 30
  },
  "sla": {
    "totalTracked": 318,
    "breached": 3,
    "atRisk": 8,
    "compliant": 307,
    "complianceRate": 96.54,
    "firstResponseComplianceRate": 98.11
  },
  "resolution": {
    "averageResolutionTimeMinutes": 187,
    "averageFirstResponseTimeMinutes": 14,
    "medianResolutionTimeMinutes": 142
  }
}


```

---

### Tickets par Statut (vue dédiée)

```
GET /api/v1/dashboard/tickets-by-status
Authorization: SUPERVISOR, ADMINISTRATOR


```

**Query params :**

```
?from=...
?to=...
?departmentId=uuid   (optionnel, filtre par département)


```

**Réponse 200 :**

```
{
  "period": { "from": "...", "to": "..." },
  "data": [
    {
      "status": "NEW",
      "count": 8,
      "percentage": 2.52,
      "avgAgeMinutes": 45
    },
    {
      "status": "IN_PROGRESS",
      "count": 22,
      "percentage": 6.92,
      "avgAgeMinutes": 320
    }
    // ...
  ]
}


```

> avgAgeMinutes = temps moyen depuis created_at pour les tickets encore ouverts dans ce statut. Utile pour détecter des statuts "bloqués".

---

### Tickets par Priorité

```
GET /api/v1/dashboard/tickets-by-priority
Authorization: SUPERVISOR, ADMINISTRATOR


```

**Query params :**

```
?from=...
?to=...
?status=OPEN   (optionnel : OPEN | RESOLVED | ALL, défaut: ALL)


```

**Réponse 200 :**

```
{
  "period": { "from": "...", "to": "..." },
  "data": [
    {
      "priority": "CRITICAL",
      "count": 7,
      "percentage": 2.20,
      "slaBreaches": 1,
      "avgResolutionTimeMinutes": 95
    },
    {
      "priority": "HIGH",
      "count": 18,
      "percentage": 5.66,
      "slaBreaches": 2,
      "avgResolutionTimeMinutes": 210
    }
    // ...
  ]
}


```

---

### Performance par Département

```
GET /api/v1/dashboard/departments
Authorization: SUPERVISOR, ADMINISTRATOR


```

**Query params :**

```
?from=...
?to=...


```

**Réponse 200 :**

```
{
  "period": { "from": "...", "to": "..." },
  "data": [
    {
      "departmentId": "uuid",
      "departmentName": "NOC",
      "tickets": {
        "total": 85,
        "open": 12,
        "resolved": 68,
        "cancelled": 5
      },
      "byPriority": {
        "CRITICAL": 4,
        "HIGH": 10,
        "MEDIUM": 45,
        "LOW": 26
      },
      "sla": {
        "compliant": 82,
        "breached": 3,
        "complianceRate": 96.47,
        "atRisk": 2
      },
      "resolution": {
        "avgResolutionTimeMinutes": 165,
        "avgFirstResponseTimeMinutes": 10
      },
      "activeAgents": 6
    }
    // ...
  ]
}


```

---

### Conformité SLA (vue dédiée)

```
GET /api/v1/dashboard/sla-compliance
Authorization: SUPERVISOR, ADMINISTRATOR


```

**Query params :**

```
?from=...
?to=...
?departmentId=uuid   (optionnel)
?priority=CRITICAL   (optionnel)
?category=NETWORK    (optionnel)


```

**Réponse 200 :**

```
{
  "period": { "from": "...", "to": "..." },
  "summary": {
    "totalTracked": 318,
    "compliant": 307,
    "breached": 3,
    "atRisk": 8,
    "complianceRate": 96.54,
    "firstResponseComplianceRate": 98.11
  },
  "byPriority": [
    {
      "priority": "CRITICAL",
      "totalTracked": 7,
      "compliant": 6,
      "breached": 1,
      "complianceRate": 85.71,
      "avgResolutionVsTargetPercent": 78.0
    }
    // ...
  ],
  "byCategory": [
    {
      "category": "NETWORK",
      "totalTracked": 120,
      "compliant": 116,
      "breached": 1,
      "complianceRate": 96.67
    }
    // ...
  ],
  "trend": [
    { "date": "2026-06-01", "complianceRate": 97.5, "breached": 1 },
    { "date": "2026-06-02", "complianceRate": 95.0, "breached": 2 }
    // ...un point par jour sur la période
  ]
}


```

> Le champ trend permet de tracer une courbe d'évolution de la conformité SLA dans le temps — très attendu sur un dashboard opérationnel.

---

### Charge des Agents

```
GET /api/v1/dashboard/workload
Authorization: SUPERVISOR, ADMINISTRATOR


```

**Query params :**

```
?departmentId=uuid   (optionnel)
?includeResolved=false   (défaut: false, tickets actifs uniquement)


```

**Réponse 200 :**

```
{
  "generatedAt": "2026-06-23T14:30:00Z",
  "data": [
    {
      "userId": "uuid",
      "fullName": "Alice Dupont",
      "role": "NOC_ENGINEER",
      "department": "NOC",
      "isActive": true,
      "workload": {
        "total": 8,
        "byStatus": {
          "ASSIGNED": 2,
          "IN_PROGRESS": 5,
          "PENDING_CUSTOMER": 1
        },
        "byPriority": {
          "CRITICAL": 1,
          "HIGH": 3,
          "MEDIUM": 3,
          "LOW": 1
        },
        "slaAtRisk": 2,
        "slaBreached": 0,
        "oldestOpenTicketAgeMinutes": 1440
      },
      "performance": {
        "resolvedLast7Days": 14,
        "avgResolutionTimeMinutes": 178
      }
    }
    // ...
  ],
  "summary": {
    "totalAgents": 12,
    "totalOpenTickets": 42,
    "avgTicketsPerAgent": 3.5,
    "unassignedTickets": 8
  }
}


```

> unassignedTickets dans le summary est important — c'est ce que le Supervisor doit voir en premier pour distribuer la charge.

---

### Temps Moyen de Résolution (tendance)

```
GET /api/v1/dashboard/resolution-time
Authorization: SUPERVISOR, ADMINISTRATOR


```

**Query params :**

```
?from=...
?to=...
?groupBy=day|week|month   (défaut: day)
?departmentId=uuid         (optionnel)
?priority=HIGH             (optionnel)


```

**Réponse 200 :**

```
{
  "period": { "from": "...", "to": "..." },
  "groupBy": "day",
  "overall": {
    "avgResolutionTimeMinutes": 187,
    "medianResolutionTimeMinutes": 142,
    "p90ResolutionTimeMinutes": 480
  },
  "trend": [
    {
      "date": "2026-06-01",
      "avgResolutionTimeMinutes": 195,
      "resolvedCount": 18
    },
    {
      "date": "2026-06-02",
      "avgResolutionTimeMinutes": 174,
      "resolvedCount": 22
    }
    // ...
  ]
}


```

> Le p90 (90ème percentile) est plus utile que la moyenne seule — il indique ce que vivent les 10% de clients les moins bien servis.

---

### Résumé des endpoints dashboard

| Endpoint <br>                             | Rôles <br>      | Couvre <br>                              |
| :---------------------------------------- | :-------------- | :--------------------------------------- |
| `GET /dashboard/overview` <br>            | SUP, ADMIN <br> | KPIs globaux consolidés <br>             |
| `GET /dashboard/tickets-by-status` <br>   | SUP, ADMIN <br> | Tickets par statut + âge moyen <br>      |
| `GET /dashboard/tickets-by-priority` <br> | SUP, ADMIN <br> | Tickets par priorité + SLA <br>          |
| `GET /dashboard/departments` <br>         | SUP, ADMIN <br> | Perf par département <br>                |
| `GET /dashboard/sla-compliance` <br>      | SUP, ADMIN <br> | Conformité SLA détaillée + tendance <br> |
| `GET /dashboard/workload` <br>            | SUP, ADMIN <br> | Charge par agent + unassigned <br>       |
| `GET /dashboard/resolution-time` <br>     | SUP, ADMIN <br> | MTTR + médiane + p90 + tendance <br>     |

# 17. Pagination, tri et recherche

Toutes les collections supportent :

```
?page=1

&limit=20

&sort=createdAt

&order=desc

&search=fiber


```

---

# 18. Architecture NestJS

## Modules

```
AuthModule

UsersModule

DepartmentsModule

TicketsModule

CommentsModule

InternalNotesModule

AttachmentsModule

NotificationsModule

SLAModule

AuditLogsModule

DashboardModule


```

---

## Structure du projet

```
src/

├── common/
│
├── config/
│
├── database/
│
├── modules/
│   │
│   ├── auth/
│   ├── users/
│   ├── departments/
│   ├── tickets/
│   ├── comments/
│   ├── internal-notes/
│   ├── attachments/
│   ├── notifications/
│   ├── sla/
│   ├── audit-logs/
│   └── dashboard/
│
├── queues/
│
├── websocket/
│
└── main.ts


```

---

# 19. Architecture interne d'un module

Exemple : Tickets

```
tickets/

├── controllers/
├── services/
├── repositories/
├── dto/
├── entities/
├── guards/
├── events/
├── interfaces/
└── tickets.module.ts


```

---

# 20. Communication asynchrone

BullMQ gère :

```
Notification Queue

Email Queue

SLA Queue

Audit Queue


```

Flux :

```
Ticket Created
      │
      ▼
 BullMQ Job
      │
      ├── Notification
      ├── Audit Log
      └── SLA Monitoring


```

---

# 21. Temps réel

NestJS WebSocket Gateway.  
Événements :

```
ticket.created

ticket.assigned

ticket.escalated

ticket.resolved

notification.created


```

---

# 22. Sécurité

Middlewares :

```
Helmet

CORS

Rate Limiting

Compression

Request Logging


```

Validation :

```
class-validator

class-transformer


```

Hashage :

```
Argon2id


```

---

# 23. Documentation API

Swagger/OpenAPI.  
URL :

```
/api/docs


```

Fonctionnalités :

- authentification JWT ;
- exemples de requêtes ;
- exemples de réponses ;
- schémas DTO ;
- codes d'erreur.
  ***

# 24. Stratégie de tests

## Unit Tests

Framework :

```
Jest


```

Couvrent :

- Services
- Guards
- Utilitaires
  ***

## Integration Tests

Couvrent :

- Base PostgreSQL
- Repositories Drizzle
  ***

## E2E Tests

Couvrent :

- API complète
- Authentification
- Workflow Ticket
  ***

# 25. Pipeline CI/CD

Je recommande :  
GitHub Actions  
Étapes :

```
Lint

Unit Tests

Integration Tests

Build

Docker Build

Deploy


```

---

# 26. Conclusion

L'architecture d'implémentation proposée exploite pleinement les capacités de NestJS, PostgreSQL, Drizzle ORM, Redis, BullMQ et de la stack d'observabilité. Elle privilégie la séparation des responsabilités, la sécurité, la testabilité et la maintenabilité, tout en restant adaptée à un déploiement de type Modular Monolith prêt à évoluer vers des besoins plus importants.
