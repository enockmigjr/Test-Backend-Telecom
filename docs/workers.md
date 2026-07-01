# Workers BullMQ — Traitement Asynchrone

## Pourquoi des Workers ?

Les opérations lentes (emails, rapports PDF, écriture audit) ne doivent pas bloquer les réponses HTTP.
BullMQ permet de les exécuter en arrière-plan, de manière fiable, avec retry automatique.

## Architecture Complète

```
PRODUCERS (ajoutent des jobs)       QUEUES (Redis)        WORKERS (traitent les jobs)      OUTPUT
─────────────────────────────       ────────────          ──────────────────────────      ──────

TicketNotificationListener          EMAIL_QUEUE           EmailWorker                     SMTP
  @OnEvent('ticket.created')        (email-queue)         concurrency: 5
  @OnEvent('ticket.assigned')                             retry: ❌ (pas de retry)
  @OnEvent('ticket.resolved')

TicketNotificationListener          NOTIFICATION_QUEUE    NotificationWorker              PostgreSQL
  @OnEvent('ticket.assigned')       (notification-queue)  concurrency: 10                + WebSocket
  @OnEvent('ticket.escalated')                            retry: ❌

TicketSlaListener                   SLA_QUEUE             SlaWorker                       PostgreSQL
  @OnEvent('ticket.created')        (sla-queue)           concurrency: 5                 UPDATE
                                                          retry: ❌

TicketAuditListener                 AUDIT_QUEUE           AuditWorker                     PostgreSQL
  @OnEvent('ticket.*')              (audit-queue)         concurrency: 20                INSERT
                                                          retry: ❌

ReportsController                   REPORT_QUEUE          ReportWorker                    PDF + Email
  POST /reports/ticket/:id          (report-queue)        concurrency: 3
  POST /reports/sla

SlaEngineService                    — (direct DB)         — (cron */5 min)                PostgreSQL
  @Cron('*/5 * * * *')
```

## Où sont définis les Workers ?

**Fichier principal**: `src/queues/queues.module.ts`

Les 5 workers sont enregistrés comme `providers` dans le `QueuesModule` (module global).
Ils implémentent `OnModuleInit` → démarrent automatiquement au lancement de l'API.

| Worker             | Fichier                                     | Queue                | Concurrency |
| ------------------ | ------------------------------------------- | -------------------- | ----------- |
| EmailWorker        | `src/queues/workers/email.worker.ts`        | `email-queue`        | 5           |
| NotificationWorker | `src/queues/workers/notification.worker.ts` | `notification-queue` | 10          |
| SlaWorker          | `src/queues/workers/sla.worker.ts`          | `sla-queue`          | 5           |
| AuditWorker        | `src/queues/workers/audit.worker.ts`        | `audit-queue`        | 20          |
| ReportWorker       | `src/queues/workers/report.worker.ts`       | `report-queue`       | 3           |

## Cycle de Vie d'un Job

1. **Ajout**: Un producer appelle `queue.add('job-name', { data })`
2. **Stockage**: BullMQ stocke le job dans Redis
3. **Traitement**: Le worker récupère le job et exécute sa fonction
4. **Succès**: Le job est marqué `completed` (gardé 1h par défaut)
5. **Échec**: Le job est marqué `failed` (gardé 24h), loggé

## Où sont ajoutés les Jobs ?

### 1. TicketNotificationListener

**Fichier**: `src/modules/tickets/listeners/ticket-notification.listener.ts`

Écoute les événements de domaine (`@OnEvent`) et ajoute des jobs :

- `ticket.created` → job email (template `ticketCreated`)
- `ticket.assigned` → job notification (type `TICKET_ASSIGNED`)
- `ticket.escalated` → job notification (type `TICKET_ESCALATED`)
- `ticket.resolved` → job email (template `ticketResolved`)

### 2. TicketAuditListener

**Fichier**: `src/modules/tickets/listeners/ticket-audit.listener.ts`

Écoute TOUS les événements ticket et ajoute des jobs audit :

- `ticket.created` → `TICKET_CREATED`
- `ticket.assigned` → `TICKET_ASSIGNED`
- `ticket.status_changed` → `STATUS_CHANGED`
- `ticket.closed` → `TICKET_CLOSED`
- `ticket.reopened` → `TICKET_REOPENED`

### 3. TicketSlaListener

**Fichier**: `src/modules/tickets/listeners/ticket-sla.listener.ts`

Écoute `ticket.created` et planifie un job SLA avec `delay` = temps restant avant échéance.
Le job vérifiera si le SLA a été respecté à l'échéance.

### 4. ReportsController

**Fichier**: `src/modules/reports/reports.controller.ts`

Les routes POST `/reports/ticket/:id` et POST `/reports/sla` ajoutent des jobs dans `REPORT_QUEUE`.
Le worker génère le rapport en arrière-plan et peut envoyer le résultat par email.

## Supervision

Les workers loguent tous les jobs (complétés/échoués) via Pino.
Les jobs échoués restent visibles 24h dans Redis.

Pour voir les jobs en attente / échoués :

```bash
# Via Redis CLI
docker compose exec redis redis-cli
> KEYS bull:*
> LLEN bull:email-queue:waiting
```
