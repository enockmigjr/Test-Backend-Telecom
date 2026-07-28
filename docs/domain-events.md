# Événements Domaine

## Vue d'ensemble

Le système utilise **EventEmitter2** pour découpler les opérations principales des effets secondaires (notifications, audit, SLA). Les événements sont émis de manière synchrone mais les listeners effectuent des traitements asynchrones via BullMQ.

---

## Événements émis

| Événement                | Émetteur          | Payload                                        |
| ------------------------ | ----------------- | ---------------------------------------------- |
| `ticket.created`         | TicketsService    | `{ ticket, creator }`                          |
| `ticket.status.changed`  | TicketsService    | `{ ticket, oldStatus, newStatus, changedBy }`  |
| `ticket.assigned`        | TicketsService    | `{ ticket, fromUser, toUser, assignedBy }`     |
| `ticket.resolved`        | TicketsService    | `{ ticket, resolvedBy }`                       |
| `ticket.closed`          | TicketsService    | `{ ticket, closedBy }`                         |
| `ticket.reopened`        | TicketsService    | `{ ticket, reopenedBy }`                       |
| `comment.created`        | CommentsService   | `{ comment, ticket, author }`                  |
| `internal-note.created`  | InternalNotesService | `{ note, ticket, author }`                  |
| `sla.warning`            | SlaEngineService  | `{ ticket, type, deadline }`                   |
| `sla.breached`           | SlaEngineService  | `{ ticket, type }`                             |
| `user.created`           | UsersService      | `{ user, temporaryPassword }`                  |

---

## Listeners

### TicketNotificationListener

Écoute les événements tickets et produit des jobs BullMQ :

```
ticket.created →
  ├── EMAIL_QUEUE     → email au créateur + superviseurs
  ├── NOTIFICATION_QUEUE → notification in-app
  ├── AUDIT_QUEUE     → log d'audit
  └── SLA_QUEUE       → job delayed (vérification breach)

ticket.assigned →
  ├── EMAIL_QUEUE     → email au nouvel assigné
  ├── NOTIFICATION_QUEUE → notification in-app
  └── AUDIT_QUEUE     → log d'audit

ticket.status.changed →
  ├── NOTIFICATION_QUEUE → notification in-app
  └── AUDIT_QUEUE     → log d'audit
```

### UserNotificationListener

```
user.created →
  └── EMAIL_QUEUE → email de bienvenue + mot de passe temporaire
```

### SlaNotificationListener

```
sla.warning →
  ├── EMAIL_QUEUE     → email d'alerte
  ├── NOTIFICATION_QUEUE → notification in-app
  └── WebSocket emit  → push temps réel

sla.breached →
  ├── EMAIL_QUEUE     → email d'alerte critique
  ├── NOTIFICATION_QUEUE → notification in-app
  └── WebSocket emit  → push temps réel
```

---

## Architecture

```
Controller → Service → EventEmitter2.emit('event', payload)
                              │
                    ┌─────────┴─────────┐
                    │     Listeners      │
                    │  (@OnEvent async)  │
                    └─────────┬─────────┘
                              │
                    ┌─────────┴─────────┐
                    │   BullMQ Queues    │
                    │  (asynchrone)      │
                    └─────────┬─────────┘
                              │
                    ┌─────────┴─────────┐
                    │     Workers        │
                    │  (traitement)      │
                    └───────────────────┘
```

**Avantage** : le contrôleur retourne immédiatement la réponse HTTP. Les emails, notifications, audit et SLA sont traités en arrière-plan sans impacter la latence.
