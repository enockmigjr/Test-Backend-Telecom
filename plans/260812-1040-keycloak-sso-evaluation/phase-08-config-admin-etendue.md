# Phase 08 — Config admin étendue

## Objectif

Exposer dans l'UI admin tous les réglages déjà supportés par le backend (settings, SLA, assignation, notifications, bot, intégrations, origines, seuils) et ceux introduits par les phases 02/03.

## Réglages cibles

1. **Settings système** (déjà existant, à compléter) : heures ouvrées, jours ouvrés, tickets max par agent, seuils SLA (warning 30 min), seuils de réaffectation absence (phase 03), durée max de pause courte.
2. **SLA** : gestion des politiques (délais par priorité/catégorie, calendrier) — page admin/sla existante à enrichir.
3. **Assignation** : algo par département (fait), pondérations (fait), auto-assignation (fait), seuils d'escalade des tickets en retard (ex. après X heures sans activité).
4. **Notifications** : règles d'envoi (qui, quels événements, canaux email/in-app), fréquence des relances SLA.
5. **Bot** : fournisseur, clé, modèle, budget, coupure (existant) + réglages UI si absents.
6. **Intégrations** : origines autorisées, quotas, apparence, confiance appareil (fait) + réglages de satisfaction (phase 05).
7. **Satisfaction** : délai d'expiration du lien, seuil de note critique (alerte admin).

## Workflow

1. Inventaire des clés `settings` existantes et des DTOs de configuration par module.
2. Ajouter les réglages manquants (clés + validation + defaults) via le module settings.
3. Compléter la page `/admin/settings` (sections par domaine, formulaires typés, historique des changements en audit).
4. Brancher les réglages dans les services concernés (cron, SLA, bot, assignation) — lecture via `SettingsService`.

## Fichiers

- `src/modules/settings/*` (service, DTOs, controller), `src/database/schemas/settings.ts`
- `src/modules/sla/*`, `src/modules/tickets/services/auto-assignment.cron.ts`, `src/modules/support-bot/*`
- `frontend/src/features/admin/settings/*`

## Risques

- Réglages non appliqués en runtime : chaque nouvelle clé doit être lue au bon endroit (tests d'intégration par réglage).
- Valeurs invalides : validation stricte côté backend (class-validator), defaults sûrs.

## Critères de validation

- Chaque réglage modifiable dans l'UI est effectif (vérifié par un test d'intégration).
- Aucune clé de réglage non documentée.
- Historique des changements de réglages dans l'audit.

## Tests

- Unitaires : validation DTO, defaults.
- Intégration : modification d'un réglage → effet observable sur le service concerné (ex. seuil d'escalade).
- E2E : édition des sections settings.
## Statut de la phase
- PARTIEL : pond�rations de charge (fait). RESTE : settings syst�me, seuils, notifications, bot.
