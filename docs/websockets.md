# WebSockets — Temps Réel

## Architecture

```
Client (navigateur)
  │
  ├── connexion WS: ws://${API_HOST:-localhost}:${API_PORT:-3000}/ws
  │     auth: { token: "Bearer <jwt>" }
  │
  ▼
TelecomWebSocketGateway (Socket.io)
  │
  ├── JWT vérifié (jsonwebtoken)
  ├── Rooms automatiques:
  │     user:{userId}
  │     department:{deptId}
  │     role:{role}
  │
  └── RedisIoAdapter (scaling horizontal)
        └── Redis pub/sub partagé entre instances API
```

## Où sont utilisés les WebSockets ?

### 1. NotificationWorker (`src/queues/workers/notification.worker.ts`)

Quand une notification est créée (ticket assigné, escaladé...), le worker vérifie si l'utilisateur est connecté et lui envoie l'événement en temps réel :

```typescript
if (this.wsGateway.isUserConnected(userId)) {
  this.wsGateway.emitToUser(userId, 'notification.created', {
    type,
    title,
    message,
    referenceType,
    referenceId,
  });
}
```

### 2. Événements émis

| Événement               | Room                                  | Déclencheur                                 |
| ----------------------- | ------------------------------------- | ------------------------------------------- |
| `notification.created`  | `user:{id}`                           | NotificationWorker (via NOTIFICATION_QUEUE) |
| `ticket.created`        | `department:{id}` + `role:SUPERVISOR` | TicketNotificationListener                  |
| `ticket.assigned`       | `user:{id}`                           | TicketNotificationListener                  |
| `ticket.escalated`      | `user:{id}` + `role:SUPERVISOR`       | TicketNotificationListener                  |
| `ticket.resolved`       | `role:SUPERVISOR`                     | TicketNotificationListener                  |
| `ticket.status_changed` | `role:SUPERVISOR`                     | TicketNotificationListener                  |
| `ticket.sla_breached`   | `user:{id}` + `role:SUPERVISOR`       | SlaEngineService (cron)                     |
| `ticket.sla_warning`    | `user:{id}` + `role:SUPERVISOR`       | SlaEngineService (cron)                     |

### 3. Rooms

| Room                  | Membres                            | Usage                                    |
| --------------------- | ---------------------------------- | ---------------------------------------- |
| `user:{userId}`       | L'utilisateur uniquement           | Notifications personnelles, assignations |
| `department:{deptId}` | Tous les membres du département    | Nouveaux tickets, changements de statut  |
| `role:{role}`         | Tous les utilisateurs avec ce rôle | Alertes superviseurs, annonces admin     |

## Authentification WebSocket

Le client envoie le JWT lors de la connexion :

```javascript
const socket = io('http://${API_HOST:-localhost}:${API_PORT:-3000}/ws', {
  auth: { token: 'Bearer eyJ...' },
});
// Ou en query param:
const socket = io('http://${API_HOST:-localhost}:${API_PORT:-3000}/ws', {
  query: { token: 'eyJ...' },
});
```

Le gateway vérifie le JWT avec `jsonwebtoken` et extrait `sub`, `role`, `departmentId`. Si le token est invalide → déconnexion immédiate.

## Scaling Horizontal

**Fichier**: `src/websocket/redis-io.adapter.ts`

En production avec plusieurs instances API, les WebSockets sont synchronisés via Redis :

```
Instance A ←→ Redis pub/sub ←→ Instance B
    │                              │
    ├── Client 1 (user:123)       ├── Client 2 (user:456)
    │                              │
```

Quand Instance A émet `emitToUser('user:456', ...)`, Redis pub/sub transmet à Instance B qui a le client 456.

**Activation**: `main.ts` initialise `RedisIoAdapter` et l'enregistre via `app.useWebSocketAdapter(redisAdapter)`.

## Fichiers clés

| Fichier                                                         | Rôle                                  |
| --------------------------------------------------------------- | ------------------------------------- |
| `src/websocket/websocket.gateway.ts`                            | Gateway Socket.io principal           |
| `src/websocket/websocket.module.ts`                             | Module global (exporté partout)       |
| `src/websocket/redis-io.adapter.ts`                             | Adapter Redis pour scaling            |
| `src/queues/workers/notification.worker.ts`                     | Consommateur — émet vers WebSocket    |
| `src/modules/tickets/listeners/ticket-notification.listener.ts` | Producteur — ajoute jobs notification |
