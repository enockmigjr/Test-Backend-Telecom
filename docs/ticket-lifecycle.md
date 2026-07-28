# Ticket Lifecycle — Machine à États

## Statuts

| Statut                  | Code                    | Description                              |
| ----------------------- | ----------------------- | ---------------------------------------- |
| Nouveau                 | `NEW`                   | Ticket vient d'être créé                 |
| Assigné                 | `ASSIGNED`              | Ticket assigné à un agent                |
| En cours                | `IN_PROGRESS`           | Agent travaille sur le ticket            |
| En attente client       | `PENDING_CUSTOMER`      | En attente d'information du client       |
| En attente tiers        | `PENDING_THIRD_PARTY`   | En attente d'un prestataire externe      |
| Résolu                  | `RESOLVED`              | Solution appliquée                       |
| Clôturé                 | `CLOSED`                | Ticket fermé définitivement              |
| Réouvert                | `REOPENED`              | Ticket réouvert après clôture            |
| Annulé                  | `CANCELLED`             | Ticket annulé (n'a plus lieu d'être)     |

---

## Diagramme des transitions

```
       ┌──────────────────────────────────────────────────┐
       │                                                  │
       │   ┌─────┐     ┌──────────┐     ┌─────────────┐  │
       │   │ NEW │────▶│ ASSIGNED │────▶│ IN_PROGRESS │  │
       │   └─────┘     └──────────┘     └──────┬──────┘  │
       │                                       │         │
       │                              ┌────────┼────────┐│
       │                              │        │        ││
       │                              ▼        ▼        ▼│
       │                        ┌─────────┐ ┌─────────┐  │
       │                        │PENDING_ │ │PENDING_ │  │
       │                        │CUSTOMER │ │THIRD_   │  │
       │                        │         │ │PARTY    │  │
       │                        └────┬────┘ └────┬────┘  │
       │                             │           │       │
       │                             └─────┬─────┘       │
       │                                   │             │
       │                                   ▼             │
       │                            ┌──────────┐         │
       │                            │ RESOLVED │         │
       │                            └─────┬────┘         │
       │                                  │              │
       │                                  ▼              │
       │                            ┌──────────┐         │
       │                            │  CLOSED  │         │
       │                            └─────┬────┘         │
       │                                  │              │
       │                                  ▼              │
       │                            ┌──────────┐         │
       │                            │ REOPENED │─────────┘
       │                            └──────────┘
       │
       │  ┌───────────┐
       └─▶│ CANCELLED │  (depuis tout statut sauf CLOSED/CANCELLED)
          └───────────┘
```

---

## Règles de transition

| De                    | Vers                           | Autorisé par                |
| --------------------- | ------------------------------ | --------------------------- |
| `NEW`                 | `ASSIGNED`                     | Supervisor, Admin, Auto-assignment |
| `ASSIGNED`            | `IN_PROGRESS`                  | Agent assigné, Supervisor, Admin |
| `IN_PROGRESS`         | `PENDING_CUSTOMER`             | Agent assigné, Supervisor, Admin |
| `IN_PROGRESS`         | `PENDING_THIRD_PARTY`          | Agent assigné, Supervisor, Admin |
| `PENDING_CUSTOMER`    | `IN_PROGRESS`                  | Agent assigné, Supervisor, Admin |
| `PENDING_THIRD_PARTY` | `IN_PROGRESS`                  | Agent assigné, Supervisor, Admin |
| `IN_PROGRESS`         | `RESOLVED`                     | Agent assigné, Supervisor, Admin |
| `RESOLVED`            | `CLOSED`                       | Supervisor, Admin            |
| `CLOSED`              | `REOPENED`                     | Supervisor, Admin            |
| `REOPENED`            | `IN_PROGRESS`                  | Agent assigné, Supervisor, Admin |
| Tout (sauf CLOSED/CANCELLED) | `CANCELLED`             | Supervisor, Admin            |

---

## SLA et lifecycle

### Premier contact (`firstResponseDueAt`)

- Commence à la **création** du ticket (`created_at`)
- Calculé selon la politique SLA de la catégorie + priorité
- Prend en compte les heures et jours ouvrables

### Résolution (`resolutionDueAt`)

- Commence à la **première assignation** (`ASSIGNED` ou `IN_PROGRESS`)
- Ne pénalise pas l'agent pour le délai d'assignation
- Prend en compte les heures et jours ouvrables

### Auto-clôture

- Tickets en statut `RESOLVED` depuis plus de **48 heures** sont automatiquement clôturés
- Cron job vérifie toutes les 5 minutes

### Breach SLA

- Cron job toutes les **5 minutes** vérifie les tickets avec SLA expiré
- Si breach détecté : `sla_breached = true` + notification + email

---

## Numérotation des tickets

Format : `INC-AAAA-NNNNNN`

- `INC` : préfixe fixe (Incident)
- `AAAA` : année sur 4 chiffres
- `NNNNNN` : numéro séquentiel sur 6 chiffres

Exemple : `INC-2026-000042`
