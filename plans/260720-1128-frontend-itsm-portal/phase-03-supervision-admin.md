# Phase 5 — Release 1 supervision et administration

## Objectif

Exposer les capacités d'analyse et de configuration réellement présentes après stabilisation de Release 1.

## Supervision

### Dashboard opérationnel

- Overview : KPIs utiles, période explicite et fraîcheur des données.
- Tickets par statut et priorité.
- Conformité SLA et tendance de résolution.
- Workload des agents, tickets non assignés et capacité disponible.
- Performance par département uniquement pour les rôles effectivement autorisés.
- Recharts installé à cette phase et chargé dynamiquement.
- Chaque graphique possède un résumé et une table alternative accessible.

### Audit

- Liste filtrée par utilisateur, action, entité et période.
- Détail ancienne/nouvelle valeur lisible et données sensibles masquées selon rôle.
- Scope départemental du superviseur respecté sur liste et détail.
- Correlation ID et contexte disponibles sans exposer d'informations techniques inutiles.

### Rapports

- Rapport ticket et SLA synchrone.
- Génération PDF asynchrone avec statut réel.
- Notification finale et téléchargement autorisé.
- Aucun écran de progression détaillée sans endpoint de statut correspondant.

## Administration

### Utilisateurs

- Liste, détail, création, modification, activation et désactivation.
- Superviseur limité à son département et aux rôles qu'il peut gérer.
- Admin seul pour création et changements privilégiés selon contrat réel.
- Indicateurs disponibilité, absence et capacité quand exposés par l'API.

### Référentiels

- Départements : CRUD admin et protections de suppression.
- Catégories : CRUD dynamique et `targetRole` correctement persisté.
- Politiques SLA : consultation pour tous les rôles concernés, mutation admin selon contrôleur actuel.
- Settings : lecture superviseur/admin, mutation admin.

## Cohérence de navigation

- Sidebar générée depuis une table de capacités centralisée.
- Accès direct à une route interdite : page 403 explicite, pas simple disparition du menu.
- Page supprimée ou ressource disparue : 404 métier distinct du 403.
- Liens profonds vers filtres, périodes et entités.

## Performance

- Chargement différé des graphiques et écrans lourds.
- Annulation des requêtes obsolètes et debounce de recherche.
- Pas de virtualisation avant test sur volumes représentatifs.
- Budgets de bundle par route et mesures Lighthouse en CI.
- RUM seulement après déploiement et consentement/configuration validés.

## Tests

- E2E des permissions admin/superviseur et du cloisonnement départemental.
- E2E génération → notification → téléchargement rapport.
- Tests a11y des graphiques, tables, dialogs et formulaires admin.
- Tests 409/429/timeout et perte de connexion pendant une action.

## Critère de sortie Release 1

Les superviseurs et administrateurs disposent d'écrans utiles, denses et auditables dont chaque donnée et action correspond à un contrat backend réel et testé.
