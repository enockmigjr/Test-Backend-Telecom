# Phase 03 — Pause / absence / absence prolongée des agents

## Objectif

Rendre la pause et l'absence réellement utilisables dans l'application (le moteur les exclut déjà de l'auto-assignation, mais aucun écran ne permet de les déclarer).

## Contexte lu dans le projet

- Colonnes existantes : `users.isAvailable` (bool, défaut true), `users.absenceEndsAt` (timestamp), `tickets.slaPausedAt`/`accumulatedPauseMs` (pause SLA via statut PENDING, hors sujet ici).
- Moteur d'assignation : exclut `isActive=false`, `isAvailable=false`, absence en cours, rôles non opérationnels ; stratégie par département.
- Cron `AutoAssignmentCron.consolidateInactiveAgentsWorkload` : désassigne les tickets des agents inactifs/absents en cas de risque SLA, puis `escalateStaleOverdueTickets` ré-achemine les tickets en retard sans activité.
- UI actuelle : fiche utilisateur admin (modification `isAvailable` + `absenceEndsAt`), badge « En pause » dans la liste.

## Design proposé (3 niveaux)

1. **Pause courte (horaire)** : bouton « Marquer en pause » / « Reprendre » dans le menu utilisateur (topbar) → `isAvailable=false` avec reprise manuelle ; durée maximale par défaut (ex. 90 min, configurable en phase 08) avant rappel. Exclut de l'auto-assignation immédiatement.
2. **Absence planifiée** : formulaire agent (ou admin pour l'agent) avec dates début/fin → `absenceEndsAt` (et `isAvailable=false` pendant la période) ; calendrier simple (début + fin). Les tickets déjà assignés restent, mais plus aucune nouvelle assignation.
3. **Absence prolongée** : au-delà d'un seuil configurable (ex. 2 jours, réglage phase 08), le cron **réaffecte automatiquement** les tickets ouverts de l'agent (désassignation + historique système + ré-acheminement via `assignmentEngine.routeTicket`), avec un délai de grâce avant escalade (ex. 6 h) pour éviter les faux positifs.

## Workflow

1. Backend : routes `PATCH /users/me/availability` (pause/reprise, bornes) et `PUT /users/:id/absence` (admin) ; validation des dates (fin > début, pas dans le passé pour la reprise) ; rejet si l'agent a des tickets critiques en cours et pas de délégation.
2. Cron : étendre `consolidateInactiveAgentsWorkload` avec le seuil d'absence prolongée lu depuis les settings ; journaliser chaque réaffectation (historique + audit).
3. Frontend : menu utilisateur (pause/reprise avec minuteur), page profil (absences passées/à venir), fiche admin (déjà partielle) + indicateur en temps réel (badge).
4. Notifications : prévenir l'agent et le superviseur à la mise en pause, à la reprise, et avant réaffectation (email + in-app).

## Fichiers

- `src/modules/users/users.controller.ts`, `users.service.ts`, DTOs
- `src/modules/tickets/services/auto-assignment.cron.ts`
- `src/modules/settings/*` (seuils : pause max, absence prolongée)
- `frontend/src/components/layout/user-menu.tsx`, `frontend/src/features/users/*`, page profil
- `src/modules/notifications/*` (templates)

## Risques

- Faux positifs d'inactivité : ne réaffecter que les tickets sans activité depuis le début de l'absence.
- Concurrence pause/reprise vs jobs : vérrouiller par transaction ; reprise pendant une réaffectation = ticket déjà réaffecté (comportement documenté).
- Sensibilité : ne pas exposer l'état « en pause » aux collègues si non souhaité (badge interne uniquement).

## Critères de validation

- Un agent en pause courte n'apparaît plus dans les candidats d'assignation (vérifié par API).
- Absence prolongée → réaffectation des tickets sans activité, historique système présent, notification envoyée.
- Reprise manuelle rétablit l'éligibilité sans action admin.
- Limites de durée et seuils configurables via settings.

## Tests

- Unitaires : service availability (bornes, validation), cron (réaffectation bornée, historique, notification).
- Intégration : candidat exclu après pause ; rééligible après reprise.
- E2E frontend : pause/reprise depuis le menu utilisateur, absence planifiée depuis la fiche admin.
## Statut de la phase
- FAIT (pouss�) : pause/reprise self-service (PATCH /users/me/availability), absence (PATCH /users/me/absence, > 7 jours = ADMINISTRATOR/SUPERVISOR), UI Param�tres.
- FAIT (pouss�) : seuil ABSENCE_REASSIGN_HOURS configurable dans le cron.
