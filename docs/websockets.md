# WebSockets & Temps Réel (Namespaces /ws & /public-support)

> Ce document détaille l'architecture temps réel Socket.IO du projet télécom.
> Le backend orchestre **deux namespaces distincts** avec isolation stricte, authentification forte et scaling Redis.

---

## 1. Vue d'ensemble des Namespaces

| Namespace           | Vocation                        | Transport                                | Authentification                                | Target Frontends                             |
| ------------------- | ------------------------------- | ---------------------------------------- | ----------------------------------------------- | -------------------------------------------- |
| \`/ws\`             | Console opérationnelle interne  | Socket.IO (WebSocket + Polling fallback) | Cookie \`access_token\` Keycloak RS256 / Bearer | Console Interne (\`frontend\` :3007)         |
| \`/public-support\` | Portail support public & Widget | Socket.IO (WebSocket + Polling fallback) | Cookie session publique \`itsm-public-session\` | Portail & Widget (\`public-frontend\` :3005) |

---

## 2. Namespace Interne \`/ws\`

### 2.1. Authentification & Sécurité (RS256 via JWKS)

La connexion au namespace \`/ws\` est validée par \`WebSocketAuthService\` (\`src/websocket/websocket-auth.service.ts\`) :

1. **Extraction du jeton** : Le jeton JWT Keycloak est extrait en priorité depuis le cookie HttpOnly \`access_token\` (\`\_\_Host-access-token\` en prod) ou du header \`Authorization: Bearer\`.
2. **Signature & Clé Publique** : La signature RS256 est vérifiée via les clés JWKS distribuées par Keycloak (\`KeycloakJwksService\`).
3. **Liaison & Profil Métier** : Le sujet Keycloak (\`sub\`) est lié au compte utilisateur en base (\`users.keycloakSubjectId = sub\`). Le compte doit être actif (\`isActive=true\`) et non supprimé (\`deletedAt IS NULL\`).
4. **Politique Mot de Passe** : Les utilisateurs devant changer leur mot de passe sont refusés au niveau du handshake Socket.IO.

### 2.2. Cloisonnement des Rooms

Une fois le handshake accepté, l'utilisateur rejoint automatiquement 3 types de rooms :

| Pattern de Room               | Membres                                        | Cas d'usage                                            |
| ----------------------------- | ---------------------------------------------- | ------------------------------------------------------ |
| \`user:{userId}\`             | Tous les onglets d'un utilisateur donné        | Notifications personnelles, assignations directes      |
| \`department:{departmentId}\` | Tous les agents et superviseurs du département | Nouveaux tickets du département, changements de statut |
| \`session:{jti}\`             | Socket spécifique à la session JWT             | Déconnexion forcée immédiate sur révocation de jeton   |

### 2.3. Événements Émis par le Backend (Interne)

- \`notification.created\` : Nouvelle notification in-app pour l'utilisateur
- \`ticket.created\` : Nouveau ticket créé dans le département
- \`ticket.assigned\` / \`ticket.deassigned\` : Notification d'assignation / désassignation
- \`ticket.escalated\` : Escalade d'incident vers un niveau supérieur
- \`ticket.status_changed\` / \`ticket.resolved\` / \`ticket.closed\` / \`ticket.reopened\` : Transitions d'état
- \`ticket.sla_warning\` / \`ticket.sla_breached\` : Alertes SLA (dépassé ou imminence < 30 min)

### 2.4. Révocation de Session en Temps Réel

\`TelecomWebSocketGateway\` écoute les événements \`auth.session.revoked\` et \`auth.user-sessions.revoked\` via EventEmitter2. Dès qu'un logout est déclenché côté API ou Keycloak, la gateway déconnecte immédiatement les sockets associés aux rooms \`session:{jti}\` ou \`user:{userId}\`.

---

## 3. Namespace Public \`/public-support\`

### 3.1. Authentification & Validation d'Origine

Le namespace \`/public-support\` sert le portail public et le widget iframe :

- **Auth** : Le cookie \`itsm-public-session\` est validé par \`PublicWebSocketAuthService\` et \`PublicSessionService\`.
- **CORS & Origines** : L'origine du handshake doit figurer dans la liste blanche \`PUBLIC_SUPPORT_ORIGINS\` (validation stricte en production via \`public-websocket-cors.ts\`).

### 3.2. Rooms du Support Public

- \`public:requester:{integrationId}:{requesterId}\` : Room du demandeur public pour recevoir le suivi global.
- \`public:conversation:{id}\` / \`public:ticket:{id}\` : Rooms de suivi d'une conversation ou d'un ticket spécifique (limitées à 100 rooms simultanées par socket).

### 3.3. Événements Émis (Public)

- \`public.refresh\` : Transmet un payload \`{ resource: 'ticket' | 'conversation' | 'attachment', id }\`. Déclenché par \`PublicRealtimeNotifierService\` lors de la publication d'un événement dans l'outbox.

---

## 4. Scaling Horizontal (Adaptateur Redis Pub/Sub)

Pour permettre le déploiement sur plusieurs instances backend (cluster Docker / Kubernetes), Socket.IO utilise \`RedisIoAdapter\` (\`src/websocket/redis-io.adapter.ts\`) :

- Les événements émis sur une instance sont publiés sur les canaux Pub/Sub Redis.
- Les autres instances reçoivent le message et transmettent l'événement aux clients connectés sur leurs propres sockets.
- Configurables via \`REDIS_URL\` (\`redis://localhost:6379\`).

---

## 5. Matrice des Fichiers Source WebSockets

| Fichier                                               | Service / Classe                  | Rôle                                                     |
| ----------------------------------------------------- | --------------------------------- | -------------------------------------------------------- |
| \`src/websocket/websocket.gateway.ts\`                | \`TelecomWebSocketGateway\`       | Gateway principale pour le namespace \`/ws\`             |
| \`src/websocket/public-support.gateway.ts\`           | \`PublicSupportGateway\`          | Gateway publique pour le namespace \`/public-support\`   |
| \`src/websocket/websocket-auth.service.ts\`           | \`WebSocketAuthService\`          | Auth JWT Keycloak RS256 / JWKS (cookies/headers)         |
| \`src/websocket/public-websocket-auth.service.ts\`    | \`PublicWebSocketAuthService\`    | Auth session publique pour le portail & widget           |
| \`src/websocket/public-realtime-notifier.service.ts\` | \`PublicRealtimeNotifierService\` | Notification temps réel du public via l'Outbox           |
| \`src/websocket/redis-io.adapter.ts\`                 | \`RedisIoAdapter\`                | Adaptateur Redis Pub/Sub pour le scaling multi-instances |
| \`src/websocket/websocket-cors.ts\`                   | \`websocketCorsOptions\`          | Validation des origines CORS interne                     |
| \`src/websocket/public-websocket-cors.ts\`            | \`publicWebsocketCorsOptions\`    | Validation des origines CORS publiques                   |
