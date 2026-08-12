# Phase 04 — Deux dashboards : agent et supervision/admin

## Objectif

Fournir un dashboard **agent** (« Mon activité », accessible à tous les rôles) et garder le dashboard **supervision/admin** actuel, avec les blocs **interne** et **support public** clairement séparés.

## Dashboard agent — « Mon activité » (`/mon-activite`)

Contenu (données déjà exposées ou à ajouter) :

- mes tickets : ouverts, en retard, à risque, critiques ; liste de mes derniers tickets avec échéances ;
- mon SLA : violations, délai moyen de résolution (période), conformité 1re réponse ;
- mon activité : dernière activité, volume résolu (mois), réouvertures ;
- mes absences/pauses : état courant + historique ;
- lien rapide « Nouveau ticket ».

Sources : `agent-performance` filtré par l'utilisateur courant, `GET /api/v1/tickets?assignedTo=<id>`, `users/me`.

## Dashboard supervision/admin — `/dashboard`

Blocs séparés (recommandé) :

- **Interne** : KPIs tickets, SLA, workload, performance agents, tendances (état actuel) ;
- **Support public** : bloc existant « Support public » (conversations, demandeurs, canaux) + à terme satisfaction et réponses ;
- onglets ou sections distinctes pour éviter la confusion.

## Workflow

1. Backend : ajouter si besoin `assignedTo` en filtre sur les endpoints dashboard (`agent-performance`) et vérifier que `tickets` supporte le filtre ; ajouter `GET /api/v1/dashboard/my-activity` (agrégats pour l'utilisateur courant) si plus simple que le filtrage client.
2. Frontend : page `/mon-activite` (cards + table + mini-tendances) ; refactor léger de `dashboard-page.tsx` en onglets Interne / Support public ; navigation (lien « Mon activité » groupe Travail).
3. RBAC : `/mon-activite` pour tous les rôles authentifiés ; `/dashboard` inchangé.

## Fichiers

- `src/modules/dashboard/dashboard.service.ts` (+ `myActivity`), `dashboard.controller.ts`
- `frontend/src/features/dashboard/components/my-activity-page.tsx` (nouveau)
- `frontend/src/components/layout/navigation.ts`, `app-sidebar.tsx`

## Risques

- Duplication de requêtes : mutualiser les agrégats réutilisables (résolution, SLA) dans des méthodes privées partagées.
- Performance : `myActivity` limité à l'utilisateur courant (index `assigned_to` existant).

## Critères de validation

- `/mon-activite` affiche les bonnes valeurs pour un agent de démo (comparées à l'API).
- Navigation accessible par rôle ; pas de régression sur `/dashboard`.
- Blocs Interne / Support public séparés visuellement sur `/dashboard`.

## Tests

- Unitaires : `myActivity` (agrégats, scope utilisateur).
- E2E frontend : accès agent, valeurs cohérentes, navigation.
