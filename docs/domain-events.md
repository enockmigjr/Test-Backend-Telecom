# Événements Domaine & Pattern Outbox Durable

> Ce document spécifie l'architecture évènementielle du système.
> Le backend utilise deux moteurs d'événements complémentaires : **EventEmitter2 (in-process asynchrone)** pour la logique applicative interne et l'**Outbox Transactionnelle (durable dans PostgreSQL)** pour la fiabilité absolue des livraisons sortantes et publiques.

---

## 1. Principes & Dualité Moteur

```
┌──────────────────────────────────────────────────────────────────────────┐
│                            MUTATION MÉTIER                               │
│                      (ex. Création de Ticket / Message)                   │
└─────────────────────────────────────┬────────────────────────────────────┘
                                      │
                 ┌────────────────────┴────────────────────┐
                 │   Transaction SQL Unique (ACID)         │
                 │  ├── INSERT INTO tickets                │
                 │  ├── INSERT INTO ticket_history         │
                 │  └── INSERT INTO outbox_events (PENDING)│
                 └────────────────────┬────────────────────┘
                                      │ (Commit réussi)
                 ┌────────────────────┴────────────────────┐
                 │                                         │
      1. EventEmitter2 (In-Process)             2. Outbox Publisher (@Interval 1s)
      ├── TicketNotificationListener            ├── Verification lock SKIP LOCKED
      ├── TicketAuditListener                   ├── Push EXTERNAL_DELIVERY_QUEUE
      ├── TicketSlaListener                     └── Push ATTACHMENT_SCAN_QUEUE
      └── TicketAssignmentListener
```

---

## 2. Événements EventEmitter2 (In-Process)

Les événements in-process servent à déclencher des effets de bord asynchrones sans ralentir la réponse HTTP à l'utilisateur.

### 2.1. Catalogue des Événements Émis

| Nom de l'événement | Service Émetteur | Payload | Listeners Récepteurs |
| --- | --- | --- | --- |
| \`ticket.created\` | \`TicketsService.createFromCommand\` | \`{ ticket, actor }\` | \`NotificationListener\`, \`AuditListener\`, \`SlaListener\`, \`AssignmentListener\` |
| \`ticket.status_changed\` | \`TicketsService.changeStatus\`, \`SlaAutoCloseService\` | \`{ ticketId, oldStatus, newStatus, actor, supportIntegrationId }\` | \`NotificationListener\`, \`AuditListener\`, \`SlaListener\` |
| \`ticket.assigned\` | \`TicketsService.assign\`, \`AssignmentEngineService\` | \`{ ticketId, assignedTo, actor, supportIntegrationId }\` | \`NotificationListener\`, \`AuditListener\` |
| \`ticket.escalated\` | \`TicketsService.escalate\` | \`{ ticketId, escalatedTo, actor, supportIntegrationId }\` | \`NotificationListener\`, \`AuditListener\` |
| \`ticket.resolved\` | \`TicketsService.changeStatus\` | \`{ ticketId, actor, supportIntegrationId }\` | \`NotificationListener\`, \`SlaListener\` |
| \`ticket.closed\` | \`TicketsService.changeStatus\`, \`SlaAutoCloseService\` | \`{ ticketId, actor, supportIntegrationId }\` | \`NotificationListener\`, \`AuditListener\`, \`SatisfactionListener\` |
| \`ticket.reopened\` | \`TicketsService.changeStatus\` | \`{ ticketId, actor, supportIntegrationId }\` | \`NotificationListener\`, \`AuditListener\` |
| \`ticket.cancelled\` | \`TicketsService.changeStatus\` | \`{ ticketId, actor }\` | \`NotificationListener\`, \`AuditListener\` |
| \`ticket.deassigned\` | \`AutoAssignmentCron\` | \`{ ticketId, deassignedAgentId, reason, departmentId }\` | \`NotificationListener\`, \`AuditListener\` |
| \`ticket.unassigned\` | \`AutoAssignmentCron\` | \`{ ticketId, ticketNumber }\` | \`AssignmentListener\` |
| \`auth.session.revoked\` | \`AuthService.logout\` | \`{ userId, jti }\` | \`TelecomWebSocketGateway\` (Déconnexion immédiate du socket) |
| \`auth.user-sessions.revoked\` | \`AuthService.logoutAll\` | \`{ userId }\` | \`TelecomWebSocketGateway\` (Déconnexion de toutes les sessions) |

---

## 3. Pattern Outbox Durable (\`outbox_events\`)

Pour garantir qu'aucun événement externe ou public ne soit perdu en cas de crash du serveur ou d'indisponibilité temporaire de Redis/SMTP, le système utilise la table \`outbox_events\`.

### 3.1. Structure de l'Enveloppe Événementielle

Chaque enregistrement dans \`outbox_events\` comporte :
- \`id\` : UUIDv7
- \`eventType\` : Chaîne identifiant le type d'événement
- \`aggregateType\` & \`aggregateId\` : Entité source (ex. \`ticket\` / \`TT-2026-000001\`)
- \`payload\` : Données JSON sérialisées
- \`status\` : Statut du cycle de vie (\`PENDING\` → \`PROCESSING\` → \`PUBLISHED\` / \`FAILED\`)
- \`deduplicationKey\` : Clé unique anti-doublon
- \`mutationId\` & \`schemaVersion\` : Versionning et traçabilité des mutations

### 3.2. Catalogue des Événements Outbox

\`TICKET_CREATED\`, \`PUBLIC_TICKET_CREATED\`, \`PUBLIC_REPLY_CREATED\`, \`PUBLIC_REPLY_CORRECTED\`, \`PUBLIC_REQUESTER_COMMENT_CREATED\`, \`PUBLIC_CONVERSATION_STARTED\`, \`PUBLIC_DRAFT_SAVED\`, \`PUBLIC_PREFERENCES_UPDATED\`, \`PUBLIC_ATTACHMENT_QUARANTINED\`, \`PUBLIC_INFORMATION_REQUESTED\`, \`PUBLIC_STATUS_CHANGED\`, \`PUBLIC_TICKET_RESOLVED\`, \`PUBLIC_TICKET_CLOSED\`, \`PUBLIC_TICKET_REOPENED\`, \`PUBLIC_HUMAN_HANDOFF_REQUESTED\`, \`SATISFACTION_REQUEST\`.

### 3.3. Dépilation et Livraison Sortante (\`OutboxPublisherService\`)

1. Un cron/interval exécuté chaque seconde (\`@Interval(1000)\`) scrute les événements \`PENDING\`.
2. Verrouillage atomique avec \`FOR UPDATE SKIP LOCKED\` sur les 100 plus anciens événements.
3. Marque les événements comme \`PROCESSING\` et pousse un job dans \`EXTERNAL_DELIVERY_QUEUE\` ou \`ATTACHMENT_SCAN_QUEUE\`.
4. Le worker consomme le job et appelle l'adaptateur de canal (\`EmailChannelAdapter\` ou webhook).
5. En cas de succès, l'événement passe à \`PUBLISHED\` avec \`publishedAt = NOW()\`. En cas d'échec, un retry avec backoff exponentiel est déclenché.
6. En cas de dépassement des tentatives (\`maxAttempts\`), l'événement passe à \`FAILED\` et alerte le système de monitoring.

---

## 4. Double Traçabilité (Audit Logs vs Ticket History)

Le système sépare strictly deux types de historiques pour répondre aux contraintes métier et réglementaires :

| Registre | Emplacement SQL | Mécanisme d'écriture | Rôle & Usage | Mode de lecture |
| --- | --- | --- | --- | --- |
| **Ticket History** | Table \`ticket_history\` | **Synchrone** dans la transaction métier (\`TicketHistoryService.recordByActor\`) | Historique fonctionnel du ticket (frise chronologique, transitions de statut, assignations visibles par l'agent) | \`GET /api/v1/tickets/:id/history\` |
| **Audit Trail** | Table \`audit_logs\` | **Asynchrone** via BullMQ \`AUDIT_QUEUE\` (\`TicketAuditListener\` → \`AuditWorker\`) | Registre légal immutable (write-only) des actions d'administration, accès sensibles, modifications de sécurité, adresses IP et user-agents | \`GET /api/v1/audit-logs\` (Réservé Admin / Superviseur) |
