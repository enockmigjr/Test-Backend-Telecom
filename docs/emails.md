# Emails — Comment, Pourquoi, Où

## Architecture

```
Événement métier (création ticket, assignation, SLA breach...)
  │
  ▼
TicketNotificationListener (@OnEvent)
  │
  ├── emailQueue.add('send-email', { to, subject, template, data })
  │
  ▼
EMAIL_QUEUE (BullMQ, Redis)
  │
  ▼
EmailWorker
  │
  ├── Compile template Handlebars (.hbs)
  ├── EmailService.sendTemplate() / EmailService.send()
  │
  ▼
Nodemailer → SMTP
  │
  ├── DEV:  Mailpit (${SMTP_HOST:-localhost}:${SMTP_PORT:-1025}) — pas d'auth
  └── PROD: SMTP configuré (host, port, user, password, TLS)
```

## Pourquoi asynchrone ?

L'envoi d'email via SMTP prend 200-500ms. Si c'était synchrone, la réponse HTTP serait bloquée.
Avec BullMQ, la requête HTTP retourne immédiatement et l'email est envoyé en arrière-plan.

## Où sont envoyés les emails ?

| Événement           | Template                  | Déclencheur                    | Destinataire         | Statut   |
| ------------------- | ------------------------- | ------------------------------ | -------------------- | -------- |
| Ticket créé         | `ticket-created.hbs`      | `@OnEvent('ticket.created')`   | Créateur du ticket   | ✅ Actif |
| Ticket assigné      | `ticket-assigned.hbs`     | `@OnEvent('ticket.assigned')`  | Agent assigné        | ✅ Actif |
| Ticket escaladé     | `ticket-assigned.hbs`     | `@OnEvent('ticket.escalated')` | Agent escaladé       | ✅ Actif |
| SLA breach          | `sla-breach.hbs`          | `SlaEngineService` cron        | Supervisor + Assigné | ✅ Actif |
| SLA warning         | `sla-warning.hbs`         | `SlaEngineService` cron        | Assigné              | ✅ Actif |
| Compte créé         | `account-created.hbs`     | `UsersService.create()`        | Nouvel utilisateur   | ✅ Actif |
| Mot de passe changé | `password-changed.hbs`    | `AuthService.changePassword()` | Utilisateur          | ✅ Actif |
| Rapport ticket      | `ticket-created.hbs`      | `ReportWorker` (async)         | Demandeur            | ✅ Actif |
| Rapport SLA         | `sla-breach.hbs`          | `ReportWorker` (async)         | Demandeur            | ✅ Actif |
| Rapport hebdo       | `admin-weekly-report.hbs` | `ReportWorker` (async)         | Admin + Supervisor   | ✅ Actif |

## Templates Handlebars

**Dossier**: `src/modules/email/templates/*.hbs`

7 templates HTML responsifs :

- `ticket-created.hbs` — Confirmation création
- `ticket-assigned.hbs` — Notification assignation
- `sla-breach.hbs` — Alerte critique (rouge)
- `sla-warning.hbs` — Avertissement (orange)
- `account-created.hbs` — Bienvenue + mot de passe temporaire
- `password-changed.hbs` — Confirmation changement
- `admin-weekly-report.hbs` — Rapport hebdomadaire avec stats

Tous les templates partagent le même design : en-tête coloré, contenu, pied de page.

## Configuration

**DEV** (automatique si `NODE_ENV=development`):

```env
SMTP_HOST=localhost
SMTP_PORT=1025
```

→ Mailpit intercepte tous les emails. Interface web: `http://localhost:${MAILPIT_WEB_PORT:-8025}`

**PROD** (si `NODE_ENV=production`):

```env
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=noreply@example.com
SMTP_PASSWORD=***
SMTP_FROM=noreply@telecom-tickets.com
SMTP_SECURE=true
```

## Fichiers clés

| Fichier                                                         | Rôle                             |
| --------------------------------------------------------------- | -------------------------------- |
| `src/modules/email/email.service.ts`                            | Service Nodemailer + Handlebars  |
| `src/modules/email/email.module.ts`                             | Module global                    |
| `src/modules/email/templates/*.hbs`                             | 7 templates HTML                 |
| `src/queues/workers/email.worker.ts`                            | Consommateur EMAIL_QUEUE → envoi |
| `src/modules/tickets/listeners/ticket-notification.listener.ts` | Producteur → ajoute jobs email   |
