# Événements Domaine

Dernière mise à jour : 2026-08-12

## Vue d'ensemble

Le système utilise deux mécanismes d'événements complémentaires :

1. **EventEmitter2 (in-process)** : les listeners déclenchent des effets de bord (notifications, audit, SLA, assignation) sans bloquer la réponse HTTP.
2. **Outbox (durable)** : les événements publics/support sont écrits dans `outbox_events` **dans la même transaction** que la mutation métier, puis publiés vers les files BullMQ par `OutboxPublisherService`. C'est le seul chemin fiable pour les livraisons externes (gate absolue : aucune notification externe ne dépend uniquement d'EventEmitter ou Redis).

## Événements EventEmitter2 émis

| Événement | Émetteur | Payload |
| --- | --- | --- |
| `ticket.created` | `TicketsService.createFromCommand` | `{ ticket, actor }` |
| `ticket.status_changed` | `TicketsService.changeStatus`, `SlaAutoCloseService` | `{ ticketId, oldStatus, newStatus, actor, supportIntegrationId }` |
| `ticket.assigned` | `TicketsService.assign`, `AssignmentEngineService.routeTicket` | `{ ticketId, assignedTo, actor, supportIntegrationId }` |
| `ticket.escalated` | `TicketsService.escalate` | `{ ticketId, escalatedTo, actor, supportIntegrationId }` |
| `ticket.resolved` / `ticket.closed` / `ticket.reopened` / `ticket.cancelled` | `TicketsService.changeStatus`, `SlaAutoCloseService` (closed) | `{ ticketId, actor, supportIntegrationId }` |
| `ticket.deassigned` | `AutoAssignmentCron` | `{ ticketId, deassignedAgentId, reason, departmentId }` |
| `ticket.unassigned` | `AutoAssignmentCron` | `{ ticketId, ticketNumber }` |
| `auth.session.revoked` | `AuthService.logout` | `{ userId, jti }` |
| `auth.user-sessions.revoked` | `AuthService.logoutAll` | `{ userId }` |

## Listeners EventEmitter2

| Listener | Événements écoutés | Effets |
| --- | --- | --- |
| `TicketNotificationListener` | created, assigned, escalated, resolved, closed, reopened, status_changed, deassigned | WebSocket + notifications in-app + emails (via files) |
| `TicketAuditListener` | created, assigned, status_changed, closed, reopened, deassigned | file `audit-queue` → `audit_logs` |
| `TicketSlaListener` | created, resolved, closed | planifie/annule le job SLA différé (`sla-breach-{ticketId}`) |
| `TicketAssignmentListener` | created, unassigned | file `assignment-queue` → routage automatique |
| `TicketSatisfactionListener` | closed | génère un lien de satisfaction et écrit un événement outbox |
| `TelecomWebSocketGateway` | auth.session.revoked, auth.user-sessions.revoked | déconnecte immédiatement les sockets concernés |

## Événements outbox (`outbox_events`)

Types d'événements écrits transactionnellement (défini dans `src/modules/tickets/domain/ticket-creation-command.ts` et les services publics) :

`TICKET_CREATED`, `PUBLIC_TICKET_CREATED`, `PUBLIC_REPLY_CREATED`, `PUBLIC_REPLY_CORRECTED`, `PUBLIC_REQUESTER_COMMENT_CREATED`, `PUBLIC_CONVERSATION_STARTED`, `PUBLIC_DRAFT_SAVED`, `PUBLIC_PREFERENCES_UPDATED`, `PUBLIC_ATTACHMENT_QUARANTINED`, `PUBLIC_INFORMATION_REQUESTED`, `PUBLIC_STATUS_CHANGED`, `PUBLIC_TICKET_RESOLVED`, `PUBLIC_TICKET_CLOSED`, `PUBLIC_TICKET_REOPENED`, `PUBLIC_HUMAN_HANDOFF_REQUESTED`, `SATISFACTION_REQUEST`.

Cycle de vie d'un événement outbox :

```
Transaction métier (insert outbox_events PENDING)
        │
        ▼
OutboxPublisherService (@Interval 1 s) — claim transactionnel, lease 60 s
        │
        ├─ PUBLIC_ATTACHMENT_QUARANTINED → attachment-scan-queue
        └─ autres → external-delivery-queue
        │
        ▼
ExternalDeliveryService.dispatch — external_deliveries (PENDING → PROCESSING → DELIVERED/FAILED)
        │
        └─ EmailChannelAdapter (template public-support-event)
```

Chaque événement porte `mutationId`, `schemaVersion`, `deduplicationKey`, `aggregateType`/`aggregateId`, l'acteur et le payload. Les reprises sont exponentielles, bornées par `maxAttempts` ; un échec final est visible (`FAILED` + `lastError`).

## Architecture

```
Service métier
   │
   ├─ emitAfterCommit → EventEmitter2 → listeners → BullMQ (email, notification, audit, sla, assignment)
   │
   └─ transaction → outbox_events → publisher → external-delivery / attachment-scan
```

Avantage : la réponse HTTP n'attend ni email, ni notification, ni PDF ; et les événements destinés au public ne peuvent pas être perdus entre PostgreSQL et Redis.

## Qui écrit quoi (double traçabilité)

| Registre | Écrit par | Sert à | Lecture |
| --- | --- | --- | --- |
| `ticket_history` | En direct dans la transaction métier (`TicketHistoryService.recordByActor`) | Timeline du ticket, réouvertures, frise | `GET /tickets/:id/history` |
| `audit_logs` | Via `audit-queue` (`TicketAuditListener` → `AuditWorker`) | Conformité, actions critiques | `GET /audit-logs` (ADMIN/SUPERVISOR) |

Les deux registres doivent être alimentés pour chaque mutation majeure. La désassignation d'urgence (`ticket.deassigned`) écrit les deux depuis 2026-08-12 ; toute nouvelle mutation doit vérifier cette règle.
