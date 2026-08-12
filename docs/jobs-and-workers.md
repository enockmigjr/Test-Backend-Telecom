# Jobs et Workers — Documentation Technique

Dernière mise à jour : 2026-08-12

## Architecture BullMQ

Le système utilise **BullMQ** (basé sur Redis) pour découpler les opérations lentes ou non-critiques du flux HTTP.

### Files (Queues) et Workers

| Queue | Consommateur | Producteurs | Description |
| --- | --- | --- | --- |
| `email-queue` | EmailWorker (concurrency 5) | TicketNotificationListener, UsersService, AuthService, SlaAlertNotifierService, ReportWorker | Emails transactionnels (15 templates Handlebars) |
| `notification-queue` | NotificationWorker (concurrency 10) | TicketNotificationListener, SlaAlertNotifierService, ReportWorker | Notifications in-app + émission WebSocket |
| `sla-queue` | SlaWorker (concurrency 5) | TicketSlaListener | Vérification différée de breach SLA par ticket |
| `audit-queue` | AuditWorker (concurrency 10) | TicketAuditListener | Écriture asynchrone des logs d'audit |
| `report-queue` | ReportWorker (concurrency 3) | ReportsController, ReportSchedulerService | Génération PDF + email avec lien signé |
| `assignment-queue` | AssignmentWorker (concurrency 10, limiter 100/s) | TicketAssignmentListener | Routage automatique des tickets |
| `external-delivery-queue` | ExternalDeliveryWorker (concurrency 5) | OutboxPublisherService | Livraisons sortantes (adaptateur email) |
| `attachment-scan-queue` | AttachmentScanWorker (concurrency 2) | OutboxPublisherService, pièces jointes publiques | Scan antivirus en quarantaine |

Tous les workers sont enregistrés dans `src/queues/queues.module.ts` (module global), y compris `ExternalDeliveryWorker`.

### Pourquoi asynchrone ?

- Emails : ne pas bloquer la réponse HTTP sur le SMTP (200-500 ms)
- Notifications : découpler la persistance DB de l'émission WebSocket
- SLA : vérifications différées à l'échéance sans impacter les requêtes
- Audit : écriture non bloquante
- Rapports : génération PDF lourde en arrière-plan
- Assignation : aiguillage découplé de la création (évite les verrous bloquants)
- Livraison externe et scan antivirus : traitements longs à retry borné

## Cron Jobs

| Fréquence | Tâche | Fichier |
| --- | --- | --- |
| Toutes les 2 min | Auto-assignation, consolidation de charge, désassignation d'urgence, escalade des tickets ASSIGNED en retard | `src/modules/tickets/services/auto-assignment.cron.ts` |
| Toutes les 5 min | Contrôle SLA (warning < 30 min, breach), auto-clôture 48 h | `src/modules/sla/sla-engine.service.ts`, `sla-alert-processor.service.ts`, `sla-auto-close.service.ts` |
| Toutes les 5 min | Récupération des scans de pièces jointes bloqués (SCANNING stale) | `src/modules/attachments/security/attachment-quarantine-cleanup.service.ts` |
| Toutes les heures | Purge des quarantaines expirées, fichiers temporaires, quarantaines promues | idem |
| Chaque seconde | Publication de l'outbox vers les files (attachment-scan / external-delivery) | `src/modules/outbox/services/outbox-publisher.service.ts` |
| Chaque minute | Rejeu des livraisons externes échouées (fenêtre 7 jours) | `src/modules/external-delivery/services/external-delivery.service.ts` |
| Lundi 06:00 | Rapport hebdomadaire PDF + email au premier administrateur actif | `src/modules/reports/report-scheduler.service.ts` |
| Tous les jours 03:00 | Purge des refresh tokens expirés / révoqués > 30 j | `src/common/services/token-cleanup.service.ts` |
| Tous les jours 04:00 | Rétention : anonymisation des demandeurs inactifs, purge challenges OTP et idempotences | `src/modules/external-requesters/services/retention-cleanup.service.ts` |

## Flux de traitement

```
1. Service émet un événement ou le contrôleur soumet une demande asynchrone
2. Listener/Contrôleur ajoute le job dans la file BullMQ appropriée
3. Worker traite le job
4. Pour les rapports : ReportWorker génère le PDF, le stocke localement,
   envoie l'email avec le lien signé HMAC (7 jours)
```

Les événements destinés au support public passent par l'outbox :

```
mutation métier → outbox_events (transaction) → OutboxPublisherService (1 s)
→ external-delivery-queue / attachment-scan-queue → statuts observables
```

## Résilience

- Tous les appels `queue.add()` sont protégés par `try/catch` : une indisponibilité Redis ne fait jamais échouer la requête HTTP.
- Les files critiques ont des retries bornés : report (3 tentatives exponentielles), external-delivery (10 tentatives fixes + rejeu 7 j), attachment-scan (8 tentatives fixes).
- `OutboxService.claim()` utilise `FOR UPDATE SKIP LOCKED` + lease 60 s : deux instances ne traitent pas le même événement.

## Supervision

BullBoard : `/admin/queues` (Basic Auth en production via `BULLBOARD_USER` / `BULLBOARD_PASSWORD`).

```bash
docker compose exec redis redis-cli
> KEYS bull:*
> LLEN bull:email-queue:waiting
> LRANGE bull:audit-queue:failed 0 10
```
