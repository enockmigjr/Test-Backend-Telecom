# Workers BullMQ — Traitement Asynchrone

Dernière mise à jour : 2026-07-01

## Pourquoi des Workers ?

Les opérations lentes ou non-critiques (emails, rapports PDF, audit, notifications) ne doivent pas bloquer les réponses HTTP.
BullMQ permet de les exécuter en arrière-plan, de manière fiable, avec persistance dans Redis.

**Principe de résilience** : Tous les appels `queue.add()` sont protégés par `try/catch`.
Si Redis est indisponible, les jobs sont droppés avec un warning — la requête HTTP n'échoue jamais à cause de l'indisponibilité des queues.

## Architecture Complète

```
PRODUCERS (ajoutent des jobs)       QUEUES (Redis)        WORKERS (traitent les jobs)      OUTPUT
─────────────────────────────       ────────────          ──────────────────────────      ──────

TicketNotificationListener          EMAIL_QUEUE           EmailWorker                     SMTP (Nodemailer)
  @OnEvent('ticket.created')        (email-queue)         concurrency: 5
  @OnEvent('ticket.assigned')                             retry: ❌ (drop si fails)
  @OnEvent('ticket.escalated')

TicketNotificationListener          NOTIFICATION_QUEUE    NotificationWorker              PostgreSQL
  @OnEvent('ticket.assigned')       (notification-queue)  concurrency: 10                + WebSocket temps réel
  @OnEvent('ticket.escalated')
  @OnEvent('ticket.resolved')

TicketSlaListener                   SLA_QUEUE             SlaWorker                       PostgreSQL
  @OnEvent('ticket.created')        (sla-queue)           concurrency: 5                 UPDATE sla_breached
  [delay = resolutionDueAt - now]

TicketAuditListener                 AUDIT_QUEUE           AuditWorker                     PostgreSQL
  @OnEvent('ticket.*')              (audit-queue)         concurrency: 20                INSERT audit_logs
  [tous les événements]

ReportsController                   REPORT_QUEUE          ReportWorker                    PDF + Email
  POST /reports/ticket/:id          (report-queue)        concurrency: 3
  POST /reports/sla
```

## Les 5 Workers — Fichiers et Responsabilités

| Worker             | Fichier                                     | Queue                | Concurrence | Rôle                                             |
| ------------------ | ------------------------------------------- | -------------------- | ----------- | ------------------------------------------------ |
| EmailWorker        | `src/queues/workers/email.worker.ts`        | `email-queue`        | 5           | Envoi d'emails via Nodemailer (7 templates)      |
| NotificationWorker | `src/queues/workers/notification.worker.ts` | `notification-queue` | 10          | Persiste en DB + émet WS si user connecté        |
| SlaWorker          | `src/queues/workers/sla.worker.ts`          | `sla-queue`          | 5           | Vérifie les breaches SLA à l'échéance            |
| AuditWorker        | `src/queues/workers/audit.worker.ts`        | `audit-queue`        | 20          | Persiste les actions en `audit_logs` (immuables) |
| ReportWorker       | `src/queues/workers/report.worker.ts`       | `report-queue`       | 3           | Génère des rapports PDF et les envoie par email  |

### Où sont-ils instanciés ?

**Fichier** : `src/queues/queues.module.ts`

Les 5 workers sont enregistrés comme `providers` dans le `QueuesModule` (module global, importé dans `AppModule`).
Ils implémentent `OnModuleInit` → démarrent automatiquement au lancement de l'API.

## Détail de Chaque Worker

### 1. EmailWorker

**Fichier** : `src/queues/workers/email.worker.ts`

**Rôle** : Envoie des emails transactionnels via Nodemailer.
En développement → Mailpit. En production → SMTP réel (`SMTP_HOST`/`SMTP_PORT`).

**Templates disponibles** :

- `ticketCreated` — confirmation de création de ticket au créateur
- `ticketAssigned` — notification d'assignation à l'agent
- `ticketResolved` — confirmation de résolution au client
- `ticketEscalated` — alerte d'escalade à l'agent cible
- `passwordReset` — lien de réinitialisation de mot de passe
- `passwordChanged` — confirmation de changement de mot de passe
- `tempPassword` — mot de passe temporaire à un nouvel utilisateur

**Déclencheurs** :

- `TicketNotificationListener` → `@OnEvent('ticket.created'|'ticket.assigned'|'ticket.escalated'|'ticket.resolved')`
- `AuthService` → directement (mot de passe temporaire, reset)

---

### 2. NotificationWorker

**Fichier** : `src/queues/workers/notification.worker.ts`

**Rôle** : Double canal de notification :

1. **Persistance DB** : INSERT dans `notifications` (consultable dans l'inbox `/api/v1/notifications`)
2. **WebSocket temps réel** : si l'utilisateur est connecté (`wsGateway.isUserConnected()`), émet l'événement immédiatement

**Événements émis** :

- `notification.created` sur la room `user:{userId}`

**Déclencheurs** :

- `TicketNotificationListener` → tickets assignés, escaladés, résolus

---

### 3. SlaWorker

**Fichier** : `src/queues/workers/sla.worker.ts`

**Rôle** : Vérifie si un ticket a respecté ses délais SLA à l'échéance.

**Mécanisme** :

1. À la création d'un ticket, `TicketSlaListener` planifie un job **délayé** : `delay = resolutionDueAt - now`
2. Le job `check_breach` s'exécute exactement à l'échéance SLA
3. Si le ticket n'est pas résolu → `sla_breached = true` + notification
4. Si le ticket est résolu/clôturé → le job est annulé (`slaQueue.remove(jobId)`)

**Complémentarité avec le cron** :
Le `SlaEngineService` tourne en cron `*/5 min` pour rattraper les breaches manquées (redémarrages, jobs perdus).

---

### 4. AuditWorker

**Fichier** : `src/queues/workers/audit.worker.ts`

**Rôle** : Persiste les événements d'audit dans la table `audit_logs` (immuable, write-only).

**Enregistrements** :

- Toutes les actions importantes sur les tickets
- Les connexions/déconnexions utilisateurs (AuthService → directement)

**Déclencheurs** :

- `TicketAuditListener` → tous les événements `ticket.*`

---

### 5. ReportWorker

**Fichier** : `src/queues/workers/report.worker.ts`

**Rôle** : Génération asynchrone de rapports PDF volumineux.

**Types de rapports** :

- `generate-ticket-report` — rapport détaillé d'un ticket (commentaires, historique, SLA)
- `generate-sla-report` — rapport de conformité SLA sur une période

**Déclencheurs** :

- `POST /api/v1/reports/ticket/:id` (Admin, Supervisor)
- `POST /api/v1/reports/sla` (Admin, Supervisor)

Le rapport est généré avec **PDFKit** et peut être envoyé par email via `EmailWorker`.

## Cycle de Vie d'un Job BullMQ

```
1. Producer → queue.add('job-name', { payload })
2. Redis → stockage persistant du job
3. Worker → traitement asynchrone
4. Succès → status: completed (conservé 1h)
5. Échec → status: failed (conservé 24h, loggé)
```

## Supervision et Debugging

Les workers loguent tous les jobs (complétés/échoués) via le logger NestJS.

```bash
# Voir les jobs en attente/échoués dans Redis
docker compose exec redis redis-cli
> KEYS bull:*
> LLEN bull:email-queue:waiting
> LRANGE bull:audit-queue:failed 0 10
```

**BullBoard** (optionnel, non installé) permettrait une UI de supervision.
