# Phase 02 — Évaluation des agents (métriques complètes + page dédiée)

## Objectif

Fournir à l'admin/superviseur une page dédiée « Performance des agents » avec toutes les métriques d'activité, de SLA et d'efficacité, pour évaluer qui travaille réellement et qui ne fait rien.

## Métriques (backend)

Endpoints existants enrichis + nouveau endpoint `GET /api/v1/dashboard/agent-performance` (déjà livré) avec :

- volume : tickets ouverts, critiques, en retard, à risque ;
- production : résolus (période), clôturés (période), réouverts (période) ;
- qualité : violations SLA cumulées, conformité 1re réponse (période), taux de réouverture ;
- performance : délai moyen de résolution, médiane, P90 (période) ;
- activité : dernière activité, jours d'inactivité, absence/pause, charge équilibrée vs moyenne d'équipe ;
- score optionnel pondéré (à valider) : ex. 40 % respect SLA, 30 % volume résolu pondéré priorité, 20 % délai, 10 % réouvertures.

## Workflow

1. Étendre `agent-performance` : `closedInPeriod`, `reopenedCount` (via `ticket_history` action `STATUS_CHANGED` → `REOPENED` ou champ `ticket_history.new_value.status`), `avg/median/p90` résolution, `firstResponseComplianceRate`, `inactiveDays`.
2. Ajouter les filtres `departmentId`, `priority`, `orderBy` (page, tri).
3. Créer la page frontend `/admin/performance` (réservée ADMINISTRATOR/SUPERVISOR) : cartes de synthèse, tableau triable, graphique de tendance par agent, badge « inactif > 48 h », export CSV.
4. (Option) score pondéré affiché avec décomposition et seuils configurables en phase 08.

## Fichiers

- `src/modules/dashboard/dashboard.service.ts` (extension agent-performance)
- `src/modules/dashboard/dashboard.controller.ts` (filtres)
- `frontend/src/features/dashboard/api/*`, nouvelle feature `frontend/src/features/performance/`
- `frontend/src/components/layout/navigation.ts` (lien)

## Risques

- Requêtes lourdes sur `ticket_history` : indexer `(ticket_id, action, created_at)` si nécessaire.
- Sémantique « réouvert » : définir = transition vers REOPENED (exclure les réassignations système).

## Critères de validation

- Page accessible selon RBAC, table triable et filtrable.
- Chaque métrique cohérente avec une requête SQL vérifiée manuellement sur les données de démo.
- Export CSV fonctionnel.
- Score (si validé) documenté et calculé sans `any`.

## Tests

- Unitaires : nouveaux agrégats (mock drizzle), score pondéré (cas limites 0 ticket).
- Contrat OpenAPI mis à jour (compte d'opérations).
- E2E frontend : accès page, tri, filtre, export.
