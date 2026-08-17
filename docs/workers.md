# Workers BullMQ — Traitement Asynchrone

Dernière mise à jour : 2026-08-12

## Les 8 Workers

Tous les workers sont enregistrés comme providers dans `src/queues/queues.module.ts` (module global) et implémentent `OnModuleInit` : ils démarrent avec l'API.

| Worker                 | Fichier                                          | Queue                     | Concurrence        | Rôle                                                                                                     |
| ---------------------- | ------------------------------------------------ | ------------------------- | ------------------ | -------------------------------------------------------------------------------------------------------- |
| EmailWorker            | `src/queues/workers/email.worker.ts`             | `email-queue`             | 5                  | Envoi d'emails via Nodemailer (Mailpit en dev, SMTP en prod), templates .hbs                             |
| NotificationWorker     | `src/queues/workers/notification.worker.ts`      | `notification-queue`      | 10                 | Persiste la notification en base puis émet `notification.created` si l'utilisateur est connecté          |
| SlaWorker              | `src/queues/workers/sla.worker.ts`               | `sla-queue`               | 5                  | Confirme la breach SLA à l'échéance (`check_breach`)                                                     |
| AuditWorker            | `src/queues/workers/audit.worker.ts`             | `audit-queue`             | 10                 | Écrit les entrées immuables dans `audit_logs`                                                            |
| ReportWorker           | `src/queues/workers/report.worker.ts`            | `report-queue`            | 3                  | Génère les PDF (ticket, SLA, hebdomadaire), stocke le fichier, notifie et envoie l'email avec lien signé |
| AssignmentWorker       | `src/queues/workers/assignment.worker.ts`        | `assignment-queue`        | 10 (limiter 100/s) | Routage automatique d'un ticket via `AssignmentEngineService.routeTicket`                                |
| ExternalDeliveryWorker | `src/queues/workers/external-delivery.worker.ts` | `external-delivery-queue` | 5                  | Livre un événement outbox via l'adaptateur de canal (email)                                              |
| AttachmentScanWorker   | `src/queues/workers/attachment-scan.worker.ts`   | `attachment-scan-queue`   | 2                  | Analyse antivirus (ClamAV) d'une pièce jointe en quarantaine                                             |

## Principe de résilience

- Tous les appels `queue.add()` sont protégés par `try/catch` : si Redis est indisponible, le job est abandonné avec un warning, la requête HTTP ne plante jamais.
- Retries : report 3 tentatives exponentielles, external-delivery 10 fixes + rejeu 7 j, attachment-scan 8 fixes.
- Les événements publics passent par l'outbox avant les files (garantie anti-perte).

## Cycle de vie d'un job

```
Producer → queue.add('job-name', { payload })
Redis → stockage persistant du job
Worker → traitement asynchrone
Succès → completed (rétention configurée par file)
Échec → failed (loggé, retry borné)
```

## Supervision

- BullBoard : `/admin/queues` (Basic Auth en production)
- Health check : `/health/ready` vérifie les files `external-delivery` et `attachment-scan` ainsi que ClamAV
- Logs Pino des workers : complétion/échec de chaque job
