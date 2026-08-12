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

| Événement           | Template                  | Déclencheur                     | Destinataire         | Statut   |
| ------------------- | ------------------------- | ------------------------------- | -------------------- | -------- |
| Ticket créé         | `ticket-created.hbs`      | `@OnEvent('ticket.created')`    | Créateur du ticket   | ✅ Actif |
| Ticket assigné      | `ticket-assigned.hbs`     | `@OnEvent('ticket.assigned')`   | Agent assigné        | ✅ Actif |
| Ticket désassigné   | `ticket-deassigned.hbs`   | `@OnEvent('ticket.deassigned')` | Agent + Superviseurs | ✅ Actif |
| Ticket escaladé     | `ticket-assigned.hbs`     | `@OnEvent('ticket.escalated')`  | Agent escaladé       | ✅ Actif |
| SLA breach          | `sla-breach.hbs`          | `SlaEngineService` cron         | Supervisor + Assigné | ✅ Actif |
| SLA warning         | `sla-warning.hbs`         | `SlaEngineService` cron         | Assigné              | ✅ Actif |
| Compte créé         | `account-created.hbs`     | `UsersService.create()`         | Nouvel utilisateur   | ✅ Actif |
| Mot de passe changé | `password-changed.hbs`    | `AuthService.changePassword()`  | Utilisateur          | ✅ Actif |
| Rapport ticket      | `ticket-report.hbs`       | `ReportWorker` (async)          | Demandeur            | ✅ Actif |
| Rapport SLA         | `sla-report.hbs`          | `ReportWorker` (async)          | Demandeur            | ✅ Actif |
| Rapport hebdo       | `admin-weekly-report.hbs` | `ReportWorker` (async)          | Admin + Supervisor   | ✅ Actif |
| Échec de rapport    | `report-failed.hbs`       | `ReportWorker` (async)          | Demandeur            | ✅ Actif |
| Code de vérification (OTP public) | `otp.hbs` | `EmailContactVerificationProvider` | Demandeur public | ✅ Actif |
| Événement support public (création, réponse, statut, satisfaction) | `public-support-event.hbs` | `EmailChannelAdapter` (external-delivery) | Demandeur public | ✅ Actif |

## Templates Handlebars

**Dossier**: `src/modules/email/templates/*.hbs`

15 templates HTML responsifs structurés avec un layout global parent :

- `base.hbs` — Layout global partagé (CSS inline, en-tête noir moderne, accents de couleur par type, footer unifié)
- `ticket-created.hbs` — Confirmation création
- `ticket-assigned.hbs` — Notification assignation
- `ticket-deassigned.hbs` — Notification désassignation d'urgence (rouge)
- `sla-breach.hbs` — Alerte critique (rouge)
- `sla-warning.hbs` — Avertissement (orange)
- `account-created.hbs` — Bienvenue + mot de passe temporaire
- `password-changed.hbs` — Confirmation changement
- `ticket-report.hbs` — E-mail de notification de rapport de ticket avec lien de téléchargement sécurisé
- `sla-report.hbs` — E-mail de notification de rapport SLA global avec lien de téléchargement sécurisé
- `admin-weekly-report.hbs` — Rapport hebdomadaire avec stats et lien de téléchargement sécurisé
- `report-failed.hbs` — Échec de génération de rapport
- `otp.hbs` — Code de vérification du support public
- `public-support-event.hbs` — Événements support public (email sortant par canal)
- `reset-password.hbs` — Réinitialisation de mot de passe (réservé)

Tous les templates s'abonnent dynamiquement au layout parent `base.hbs` pour un design unifié et cohérent.

> En cas de template `.hbs` manquant ou d'erreur de rendu, `EmailWorker` utilise un **repli générique** (`fallbackTemplate`) : aucun contenu n'est dupliqué dans le code, les `.hbs` restent la source unique.

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
| `src/modules/email/templates/*.hbs`                             | 15 templates HTML                |
| `src/queues/workers/email.worker.ts`                            | Consommateur EMAIL_QUEUE → envoi |
| `src/modules/tickets/listeners/ticket-notification.listener.ts` | Producteur → ajoute jobs email   |
