# WebSockets — Temps Réel

Dernière mise à jour : 2026-08-12

Le backend expose **deux namespaces Socket.IO distincts** :

1. `/ws` — espace interne (agents, superviseurs, administrateurs)
2. `/public-support` — espace public (demandeurs, portail, widget)

## Namespace interne `/ws`

### Authentification

Le token d'accès JWT est lu dans le **cookie HttpOnly** posé par le BFF (`__Host-access-token` en production, `access_token` en dev) — pas dans un token de query. `WebSocketAuthService` vérifie la signature, la non-révocation Redis et le statut du compte ; les utilisateurs devant changer leur mot de passe sont refusés.

### Rooms automatiques

| Room | Membres | Usage |
| --- | --- | --- |
| `user:{userId}` | l'utilisateur (tous ses onglets) | notifications personnelles, assignations |
| `department:{departmentId}` | le département | nouveaux tickets, changements de statut |
| `session:{jti}` | la session JWT | déconnexion immédiate sur révocation |

### Événements émis

`notification.created`, `ticket.created`, `ticket.assigned`, `ticket.escalated`, `ticket.resolved`, `ticket.closed`, `ticket.reopened`, `ticket.deassigned`, `ticket.status_changed`, `ticket.sla_warning`, `ticket.sla_breached`.

Émetteurs : `TicketNotificationListener` (direct) et `NotificationWorker` (après persistance) — voir la note sur la double émission dans les analyses techniques.

### Révocation de session

`TelecomWebSocketGateway` écoute `auth.session.revoked` et `auth.user-sessions.revoked` et déconnecte immédiatement les sockets concernés (rooms `session:{jti}` / `user:{userId}`).

## Namespace public `/public-support`

### Authentification

Cookie de session publique (portail et widget) validé par `PublicWebSocketAuthService` + `PublicSessionService` ; l'origine du handshake doit figurer dans `PUBLIC_SUPPORT_ORIGINS` (préfixe `__Host-` imposé en production).

### Rooms

- `public:requester:{integrationId}:{requesterId}` — room principale du demandeur
- `public:conversation:{id}` et `public:ticket:{id}` — rejointes pour les conversations/tickets récents (100 max)

### Événements émis

`public.refresh` avec `{ resource: 'ticket' | 'conversation' | 'attachment', id }`, déclenché par `PublicRealtimeNotifierService` après publication d'un événement outbox.

## Scaling Horizontal

`RedisIoAdapter` (`src/websocket/redis-io.adapter.ts`) synchronise les deux namespaces entre instances via Redis pub/sub ; il est installé dans `main.ts` avec `app.useWebSocketAdapter`.

## CORS

- Interne : `websocket-cors.ts` (liste `CORS_ORIGIN`, joker interdit en production)
- Public : `public-websocket-cors.ts` (liste `PUBLIC_SUPPORT_ORIGINS`, joker interdit en production)

## Fichiers clés

| Fichier | Rôle |
| --- | --- |
| `src/websocket/websocket.gateway.ts` | Gateway interne `/ws` |
| `src/websocket/public-support.gateway.ts` | Gateway publique `/public-support` |
| `src/websocket/websocket-auth.service.ts` | Auth JWT interne (cookie) |
| `src/websocket/public-websocket-auth.service.ts` | Auth session publique (cookie portail/widget) |
| `src/websocket/public-realtime-notifier.service.ts` | Notification `public.refresh` depuis l'outbox |
| `src/websocket/redis-io.adapter.ts` | Adapter Redis pour le scaling |
