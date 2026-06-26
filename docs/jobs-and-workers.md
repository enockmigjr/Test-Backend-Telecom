# Jobs et Workers — Documentation Technique

## Architecture BullMQ

Le système utilise **BullMQ** (basé sur Redis) pour le traitement asynchrone. Cela permet de découpler les
opérations lentes ou non-critiques du flux HTTP principal.

### Files (Queues) Définies

| Queue | Clé | Producteur | Consommateur (Worker) | Description |
|-------|-----|-----------|----------------------|-------------|
| `email-queue` | `EMAIL_QUEUE` | TicketService, AuthService | `EmailProcessor` | Envoi d'emails transactionnels |
| `notification-queue` | `NOTIFICATION_QUEUE` | TicketService, SlaEngine | `NotificationProcessor` | Création notifications + WebSocket emit |
| `sla-queue` | `SLA_QUEUE` | TicketService, SlaEngine | `SlaProcessor` | Vérification SLA, breach, escalation |
| `audit-queue` | `AUDIT_QUEUE` | Tous les services | `AuditProcessor` | Écriture asynchrone des logs d'audit |

### Flux de Traitement

```
1. Service émet un Domain Event (via EventEmitter2)
2. Listener asynchrone capture l'event
3. Listener ajoute un job dans la queue BullMQ appropriée
4. Worker (processus séparé) traite le job
5. Résultat: email envoyé, notification créée, SLA vérifié, audit log écrit
```

### Pourquoi Asynchrone ?

- **Emails**: Ne pas bloquer la réponse HTTP pendant l'envoi SMTP (200-500ms)
- **Notifications**: Découpler la création en base de l'émission WebSocket
- **SLA**: Vérifications périodiques sans impacter les requêtes utilisateur
- **Audit**: Écriture non-bloquante pour ne pas ralentir les opérations métier

## Cron Jobs

### SLA Engine (`SlaEngineService.checkSla()`)

- **Fréquence**: Toutes les 5 minutes (`*/5 * * * *`)
- **Fonctionnement**:
  1. Récupère tous les tickets actifs (statut hors RESOLVED, CLOSED, CANCELLED)
  2. Vérifie si `resolutionDueAt < NOW()` → SLA BREACH
  3. Vérifie si `resolutionDueAt` dans < 30 min → SLA WARNING
  4. Marque `sla_breached = true` sur les tickets en breach
- **Impact**: ~10-50ms par exécution (requête SQL avec index)

### À Implémenter

- **Auto-escalade**: Si SLA breach + `sla_policies.auto_escalate = true` → escalader au supervisor
- **Nettoyage des tokens expirés**: Cron quotidien pour supprimer les refresh_tokens expirés
- **Rapports quotidiens**: Génération de rapports CSV/PDF programmée

## Observabilité des Jobs

Chaque job BullMQ expose:
- `job.id` — identifiant unique
- `job.attemptsMade` — nombre de tentatives
- `job.finishedOn` — timestamp de complétion
- `job.failedReason` — raison d'échec (si échoué)

Les workers loguent chaque job traité avec Pino (niveau info/error selon succès/échec).
