# Phase 4 — Release 1 opérations tickets et temps réel

## Objectif

Livrer la console quotidienne des agents sur les capacités réellement supportées, sans simuler le Client 360°, les formulaires dynamiques ou les opérations télécom absentes.

## Navigation Release 1

- Connexion, changement de mot de passe et profil.
- Ma file / tickets pertinents selon scope backend.
- Tous les tickets accessibles au rôle.
- Création de ticket.
- Détail de ticket.
- Notifications.
- Référentiels en lecture nécessaires aux formulaires.

## Liste de tickets

- Filtres serveur : statut, priorité, sévérité, catégorie, assigné, équipes, département, créateur, dates et recherche existante.
- Pagination, filtres et ordre synchronisés avec l'URL.
- En-tête figé, colonnes essentielles et densité contrôlée.
- Conservation du scroll, de la page et de la sélection au retour.
- Refetch silencieux sans remplacer les données visibles par un skeleton.
- Pas de multi-tri, tolérance aux fautes ou virtualisation avant contrat et mesure.

## Création

- Formulaire RHF/Zod aligné sur `CreateTicketDto` corrigé.
- Catégories chargées depuis l'API, jamais codées en enum frontend.
- Priorité et sévérité séparées; client limité aux champs réellement existants.
- `assignedTeamId` et politique SLA déterminés selon le contrat validé.
- Détection des modifications non enregistrées.
- Idempotency key stable pendant une intention de soumission.
- Confirmation serveur avant succès et lien vers le ticket créé.

## Détail ticket

- En-tête compact : numéro, titre, statut, priorité, sévérité, équipe et assigné.
- Rail SLA : première réponse, résolution, pause, risque et échéance calculés depuis les timestamps serveur.
- Sections : aperçu, historique, affectations, commentaires, notes internes et pièces jointes.
- Notes internes masquées aux techniciens terrain et protégées côté serveur.
- Pièces jointes seulement après listing, scope et validation upload disponibles.
- Pas de « Client 360° » : afficher uniquement le contexte client minimal du ticket.

## Actions métier

- Démarrer, assigner, réassigner, escalader, mettre en attente, résoudre, fermer, rouvrir et annuler selon permission réelle.
- Le bouton désactivé explique la règle non satisfaite.
- Motif exigé lorsque le backend l'exige; confirmation renforcée pour action destructive.
- Aucune transition inventée; la machine d'état backend reste source de vérité.
- Gestion dédiée des 400, 401, 403, 404, 409, 429, timeout et réseau.

## Collaboration

- Commentaires publics séparés des notes internes.
- Conservation du brouillon en mémoire pendant l'écran; persistance locale différée et interdite aux données sensibles sans décision dédiée.
- Historique immuable affichant auteur, date et changements structurés.
- Téléchargement sécurisé via BFF ou URL signée selon le contrat retenu.

## Notifications et realtime

- Inbox, compteur non lu, lecture individuelle et globale.
- Optimistic update uniquement sur marquage lu, avec rollback explicite.
- État `connected`, `reconnecting`, `offline` et dernière synchronisation visible.
- Mapping événements → invalidations ciblées des queries.
- Déduplication des événements et resynchronisation après reconnexion.
- Aucun nouvel élément ne fait sauter le scroll de l'utilisateur.

## États UX obligatoires

- Initial loading, refetch silencieux, pagination, mutation, upload et traitement asynchrone.
- Empty initial, filtres sans résultat, recherche sans résultat, permission absente et service indisponible.
- Erreur indiquant ce qui s'est passé, ce qui est conservé, l'action possible et si le retry est sûr.
- Correlation ID copiable et détails techniques repliés.

## Tests par slice

- Tests unitaires des permissions et transitions affichées.
- Tests composants des formulaires et états réseau.
- E2E réels : création, assignation, cycle de vie, commentaire, note, fichier, notification et refus 403.
- Couverture de plusieurs départements et des rôles réellement concernés.
- MSW limité aux pannes, délais, 409, 429 et réponses partielles difficiles à reproduire.

## Critère de sortie Release 1

Un agent peut traiter un ticket de bout en bout avec session sécurisée, permissions exactes, erreurs récupérables, realtime résilient et navigation clavier, sans exposer de données hors scope.
