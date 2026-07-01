# Jobs et Workers — Documentation Technique

Dernière mise à jour : 2026-07-01

## Architecture BullMQ

Le système utilise **BullMQ** (basé sur Redis) pour le traitement asynchrone. Cela permet de découpler les
opérations lentes ou non-critiques du flux HTTP principal.

### Files (Queues) Définies

| Queue                | Clé                  | Producteurs                                                                           | Consommateur (Worker) | Description                                     |
| -------------------- | -------------------- | ------------------------------------------------------------------------------------- | --------------------- | ----------------------------------------------- |
| `email-queue`        | `EMAIL_QUEUE`        | TicketNotificationListener, UsersService, AuthService, ReportWorker, SlaEngineService | `EmailWorker`         | Envoi d'emails transactionnels (10 flux actifs) |
| `notification-queue` | `NOTIFICATION_QUEUE` | TicketNotificationListener, SlaEngineService, ReportWorker                            | `NotificationWorker`  | Création notifications + émission WebSocket     |
| `sla-queue`          | `SLA_QUEUE`          | TicketSlaListener                                                                     | `SlaWorker`           | Vérification SLA différée (delayed job)         |
| `audit-queue`        | `AUDIT_QUEUE`        | TicketAuditListener                                                                   | `AuditWorker`         | Écriture asynchrone des logs d'audit            |
| `report-queue`       | `REPORT_QUEUE`       | ReportsController                                                                     | `ReportWorker`        | Génération rapports + notification + email      |

### Flux de Traitement

```
1. Service émet un Domain Event (via EventEmitter2)
2. Listener asynchrone capture l'event
3. Listener ajoute un job dans la queue BullMQ appropriée
4. Worker traite le job
5. Résultat: email envoyé, notification créée, SLA vérifié, audit log écrit, rapport généré
```

### Pourquoi Asynchrone ?

- **Emails**: Ne pas bloquer la réponse HTTP pendant l'envoi SMTP (200-500ms)
- **Notifications**: Découpler la création en base de l'émission WebSocket
- **SLA**: Vérifications différées sans impacter les requêtes utilisateur
- **Audit**: Écriture non-bloquante pour ne pas ralentir les opérations métier
- **Rapports**: Génération PDF (lourde) en arrière-plan, notification à l'utilisateur quand c'est prêt

## Cron Jobs

### SLA Engine (`SlaEngineService.checkSla()`)

- **Fréquence**: Toutes les 5 minutes (`*/5 * * * *`)
- **Fonctionnement**:
  1. Récupère tous les tickets actifs (hors RESOLVED, CLOSED, CANCELLED)
  2. Vérifie si `resolutionDueAt < NOW()` → SLA BREACH
  3. Vérifie si `resolutionDueAt` dans < 30 min → SLA WARNING
  4. Marque `sla_breached = true` sur les tickets en breach
- **Actions**: DB update + métrique Prometheus + WebSocket + notification + email
- **Impact**: ~10-50ms par exécution (requête SQL avec index)

## Observabilité des Jobs

Chaque job BullMQ expose:

- `job.id` — identifiant unique
- `job.attemptsMade` — nombre de tentatives
- `job.finishedOn` — timestamp de complétion
- `job.failedReason` — raison d'échec (si échoué)

Les workers loguent chaque job traité avec Pino (niveau info/error selon succès/échec).

## Résilience

Tous les appels `queue.add()` sont protégés par `try/catch`.
Si Redis est indisponible, les jobs sont droppés avec un warning — la requête HTTP n'échoue **jamais** à cause de l'indisponibilité des queues.

## Supervision

```bash
# Voir les jobs en attente/échoués dans Redis
docker compose exec redis redis-cli
> KEYS bull:*
> LLEN bull:email-queue:waiting
> LRANGE bull:audit-queue:failed 0 10
```
