# Matrice frontend — rôles, pages et actions

## Décision finale appliquée au backend

- Le superviseur reste strictement limité à son département pour les utilisateurs, tickets, audits, dashboards et rapports.
- Le dashboard de performance des départements est accessible au superviseur, mais ne retourne que son département.
- La création et la modification des politiques SLA restent réservées à l'administrateur, car elles modifient un référentiel global.
- Les rapports d'un superviseur sont limités à ses propres demandes et, pour les données SLA, à son département.
- Le créateur ne peut modifier titre, description et catégorie que tant que le ticket est `NEW`.
- Une assignation ou une escalade exige une cible active, non supprimée et rattachée à l'équipe de destination.
- Le temps réel ne diffuse qu'aux rooms utilisateur et département calculées par le serveur ; aucune room globale de rôle n'est autorisée.
- `logout` ferme les sockets de la session concernée et `logout-all` ferme tous les sockets tout en invalidant les access tokens antérieurs.
- Les permissions frontend restent une aide UX ; toutes ces règles sont appliquées et testées côté backend.

## Objet

Cette matrice décrit le comportement effectif constaté dans les contrôleurs et services. Elle ne reprend pas aveuglément les matrices documentaires lorsqu'elles contredisent le code. Les permissions frontend restent des aides UX; le backend est toujours autoritaire.

## Légende

- `✅` : capacité accessible selon le contrat actuel.
- `—` : non autorisée par le backend actuel.
- `Scope` : rôle, département, ownership, assignation et statut peuvent restreindre l'action.

## Pages et modules

| Surface                                                    | Admin |           Supervisor | CS Agent |      NOC |  Billing | Tech Support | Field Tech |
| ---------------------------------------------------------- | ----: | -------------------: | -------: | -------: | -------: | -----------: | ---------: |
| Connexion, profil, mot de passe                            |    ✅ |                   ✅ |       ✅ |       ✅ |       ✅ |           ✅ |         ✅ |
| Tickets : liste, création, détail                          |    ✅ | ✅ Scope département | ✅ Scope | ✅ Scope | ✅ Scope |     ✅ Scope |   ✅ Scope |
| Commentaires publics                                       |    ✅ | ✅ Scope département | ✅ Scope | ✅ Scope | ✅ Scope |     ✅ Scope |   ✅ Scope |
| Notes internes                                             |    ✅ | ✅ Scope département | ✅ Scope | ✅ Scope | ✅ Scope |     ✅ Scope |          — |
| Pièces jointes                                             |    ✅ | ✅ Scope département | ✅ Scope | ✅ Scope | ✅ Scope |     ✅ Scope |   ✅ Scope |
| Notifications                                              |    ✅ |                   ✅ |       ✅ |       ✅ |       ✅ |           ✅ |         ✅ |
| Référentiels en lecture                                    |    ✅ |                   ✅ |       ✅ |       ✅ |       ✅ |           ✅ |         ✅ |
| Dashboard overview/status/priority/SLA/workload/résolution |    ✅ |                   ✅ |        — |        — |        — |            — |          — |
| Dashboard performance départements                         |    ✅ |   ✅ Son département |        — |        — |        — |            — |          — |
| Utilisateurs : liste/détail/modification                   |    ✅ | ✅ Scope département |        — |        — |        — |            — |          — |
| Utilisateurs : création/activation/désactivation           |    ✅ |                    — |        — |        — |        — |            — |          — |
| Départements et catégories : gestion                       |    ✅ |                    — |        — |        — |        — |            — |          — |
| Politiques SLA : gestion                                   |    ✅ |                    — |        — |        — |        — |            — |          — |
| Settings : lecture                                         |    ✅ |                   ✅ |        — |        — |        — |            — |          — |
| Settings : modification                                    |    ✅ |                    — |        — |        — |        — |            — |          — |
| Audit : liste/détail                                       |    ✅ | ✅ Scope département |        — |        — |        — |            — |          — |
| Rapports : données et génération                           |    ✅ |                   ✅ |        — |        — |        — |            — |          — |
| Rapports : liste globale                                   |    ✅ |                    — |        — |        — |        — |            — |          — |
| Rapports : téléchargement                                  |    ✅ |                   ✅ |        — |        — |        — |            — |          — |

Les scopes tickets/commentaires/notes/fichiers sont appliqués côté backend et couverts par des tests négatifs inter-départements. Le parcours Playwright agent vérifie aussi un refus HTTP 403 réel sur un ticket NOC hors périmètre. Le frontend doit masquer les actions non autorisées, sans jamais se substituer à ces contrôles backend.

## Actions sur un ticket

| Action                               | Règle effective à refléter dans l'UI                                                    |
| ------------------------------------ | --------------------------------------------------------------------------------------- |
| Créer                                | Tout utilisateur authentifié.                                                           |
| Voir le détail                       | Admin, ou créateur, assigné, département propriétaire ou équipe assignée.               |
| S'auto-assigner                      | Ticket `NEW`, non assigné, équipe assignée égale au département de l'utilisateur.       |
| Assigner à un tiers                  | Admin ou supervisor; cible active appartenant obligatoirement à l'équipe assignée.      |
| Réassigner                           | Admin, supervisor ou assigné actuel; cible active dans l'équipe et scope départemental. |
| Escalade hiérarchique                | Assigné, supervisor ou admin; cible active dans le même département technique.          |
| Escalade fonctionnelle               | Admin ou supervisor; cible active dans le département de destination.                   |
| Démarrer                             | Assigné, supervisor ou admin, depuis `ASSIGNED` ou `REOPENED`.                          |
| Mettre en attente                    | Assigné, supervisor ou admin, depuis `IN_PROGRESS`.                                     |
| Résoudre                             | Assigné, supervisor ou admin depuis un statut autorisé.                                 |
| Fermer                               | Assigné, supervisor ou admin, depuis `RESOLVED`.                                        |
| Réouvrir                             | Admin, supervisor, ou CS Agent créateur sous 30 jours; transition valide requise.       |
| Annuler                              | Admin ou supervisor, depuis un statut autorisé.                                         |
| Supprimer logiquement                | Admin uniquement.                                                                       |
| Modifier titre/description           | Créateur uniquement en `NEW`, ou assigné, supervisor ou admin.                          |
| Modifier priorité/sévérité           | Supervisor ou admin.                                                                    |
| Modifier tags/métadonnées/résolution | Assigné, supervisor ou admin.                                                           |
| Modifier politique SLA               | Admin uniquement.                                                                       |
| Modifier catégorie                   | Créateur uniquement en `NEW`, ou supervisor/admin, via `categoryId`.                    |
| Ajouter une note interne             | Tous sauf Field Technician, sous réserve de visibilité effective du ticket.             |

## Règles de présentation

- Une action interdite fréquente peut rester visible mais désactivée avec une raison explicite.
- Une surface entière non pertinente au rôle est retirée de la navigation.
- Un deep link interdit rend une page 403, jamais une fausse 404 silencieuse.
- Un 403 serveur prime toujours sur le calcul local et conserve le formulaire lorsque possible.
- Les actions disponibles sont recalculées après mutation, refresh de session et événement de rôle.

## Arbitrages définitifs

1. Le supervisor est départemental, jamais global.
2. La gestion des politiques SLA reste administrateur uniquement.
3. Le dashboard départements est disponible au supervisor, limité à son département.
4. Le profil propre à chaque agent passe par `/users/me`; `/users/:id` reste réservé à l'administration et la supervision.

## Critère de validation

La matrice est le contrat produit Release 1. Les 15 suites E2E backend (127 tests) et les parcours critiques frontend couvrent les refus inter-départements et les principales transitions ; chaque nouvelle action frontend doit conserver un test négatif serveur correspondant.
