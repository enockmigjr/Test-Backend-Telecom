# Jobs et Workers — Documentation Technique

Dernière mise à jour : 2026-07-02

## Architecture BullMQ

Le système utilise **BullMQ** (basé sur Redis) pour le traitement asynchrone. Cela permet de découpler les
opérations lentes ou non-critiques du flux HTTP principal.

### Files (Queues) Définies

| Queue                | Clé                  | Producteurs                                                                           | Consommateur (Worker) | Description                                      |
| -------------------- | -------------------- | ------------------------------------------------------------------------------------- | --------------------- | ------------------------------------------------ |
| `email-queue`        | `EMAIL_QUEUE`        | TicketNotificationListener, UsersService, AuthService, ReportWorker, SlaEngineService | `EmailWorker`         | Envoi d'emails transactionnels (+10 flux actifs) |
| `notification-queue` | `NOTIFICATION_QUEUE` | TicketNotificationListener, SlaEngineService, ReportWorker                            | `NotificationWorker`  | Création notifications + émission WebSocket      |
| `sla-queue`          | `SLA_QUEUE`          | TicketSlaListener                                                                     | `SlaWorker`           | Vérification SLA différée (delayed job)          |
| `audit-queue`        | `AUDIT_QUEUE`        | TicketAuditListener                                                                   | `AuditWorker`         | Écriture asynchrone des logs d'audit             |
| `report-queue`       | `REPORT_QUEUE`       | ReportsController                                                                     | `ReportWorker`        | Génération rapports PDF premium + envoi email    |
| `assignment-queue`   | `ASSIGNMENT_QUEUE`   | TicketAssignmentListener                                                              | `AssignmentWorker`    | Moteur d'auto-assignation et aiguillage          |

### Flux de Traitement

```
1. Service émet un Domain Event ou le contrôleur soumet une demande de rapport (asynchrone)
2. Listener/Contrôleur ajoute le job dans la queue BullMQ appropriée
3. Worker traite le job
4. Pour les rapports : ReportWorker génère un document PDFKit élégant (en-têtes sombres, grilles)
5. ReportWorker stocke le PDF localement et soumet l'envoi d'e-mail avec le lien sécurisé de téléchargement à l'EMAIL_QUEUE
6. EmailWorker consomme le job et envoie l'e-mail de succès au destinataire contenant le lien de téléchargement unique
```

### Pourquoi Asynchrone ?

- **Emails**: Ne pas bloquer la réponse HTTP pendant l'envoi SMTP (200-500ms)
- **Notifications**: Découpler la création en base de l'émission WebSocket
- **SLA**: Vérifications différées sans impacter les requêtes utilisateur
- **Audit**: Écriture non-bloquante pour ne pas ralentir les opérations métier
- **Rapports**: Génération PDF (lourde) en arrière-plan, notification à l'utilisateur quand c'est prêt
- **Assignation**: Aiguillage automatique découplé de la création du ticket (évite les verrous de DB bloquants)

## Cron Jobs

### SLA Engine (`SlaEngineService.checkSla()`)

- **Fréquence**: Toutes les 5 minutes (`*/5 * * * *`)
- **Fonctionnement**:
  1. Récupère tous les tickets actifs (hors RESOLVED, CLOSED, CANCELLED)
  2. Vérifie si `resolutionDueAt < NOW()` → SLA BREACH
  3. Vérifie si `resolutionDueAt` dans < 30 min → SLA WARNING
  4. Marque `sla_breached = true` sur les tickets en breach
  5. **Auto-clôture** : passe les tickets `RESOLVED` depuis plus de 48h en `CLOSED` (avec entrée d'historique système)
- **Actions**: DB update + métrique Prometheus + WebSocket + notification + email
- **Impact**: ~10-50ms par exécution (requête SQL avec index)

### Auto-Assignation et Consolidation (`AutoAssignmentCron.runAutoAssignment()`)

- **Fréquence**: Toutes les 2 minutes (`*/2 * * * *`)
- **Fonctionnement**:
  1. Vérifie si la vue matérialisée du workload (`materialized_workload_view`) existe dans `pg_matviews` avant de rafraîchir.
  2. Traite le retour d'absence des agents (remet en disponibilité).
  3. Effectue la **désassignation d'urgence** des agents inactifs ou absents (désassignation immédiate si absence de plus de 24 heures ou si l'agent est hors-ligne et que l'échéance SLA approche).
  4. Récupère et route les tickets non assignés (NEW, REOPENED) par lots de 50 (avec traitement parallèle par groupes de 10).
- **Actions**: DB update + émission de l'événement `ticket.deassigned` (avec envoi de notifications DB et e-mail à l'agent indisponible et aux superviseurs de son département).

### Rapport Hebdomadaire Automatique (`ReportsService.handleWeeklyReportCron()`)

- **Fréquence**: Tous les lundis matin à 06h00 (`0 6 * * 1`)
- **Fonctionnement**:
  1. Identifie le premier administrateur actif dans le système.
  2. Crée un enregistrement de rapport de type `weekly-report` avec le statut `pending` en base de données.
  3. Pousse un job de génération dans la file `report-queue`.
  4. Le worker traite la demande en tâche de fond (calcul des KPI de la semaine écoulée, conformité SLA, grilles graphiques).
- **Actions**: Persistance DB (table `reports`) + Stockage PDF + WebSocket + Notification + E-mail au demandeur.

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
