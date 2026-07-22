# Carte des capacités backend pour le frontend

## Verdict

Le backend couvre un noyau ITSM crédible, mais pas l'ensemble du produit décrit dans le brief. Le frontend doit séparer trois niveaux : exploitable après sécurisation, partiel nécessitant un contrat complémentaire, absent nécessitant une vraie évolution métier.

La Release 1 validée couvre le ticketing, le temps réel, les dashboards et les surfaces supervisor/admin déjà soutenues par le backend. Les absences listées plus bas restent explicitement hors frontend tant qu'une évolution backend réelle ne les fournit pas.

## Exploitable après fermeture des gates P0

| Domaine       | Capacités réelles                                                                        |
| ------------- | ---------------------------------------------------------------------------------------- |
| Auth          | Login, profil, changement de mot de passe, refresh, logout, logout-all.                  |
| Organisation  | Sept rôles, départements, utilisateurs, disponibilité, absence et capacité agent.        |
| Tickets       | Création, recherche filtrée, détail, modification, soft delete et cycle de vie complet.  |
| Affectation   | Auto-assignation, self-assign, assignation, réassignation, escalade et historique.       |
| Collaboration | Commentaires publics, notes internes et historique ticket.                               |
| Notifications | Inbox persistante, non-lues, lecture individuelle/globale et événements Socket.IO.       |
| SLA           | Politiques par catégorie/priorité, échéances, pauses pending, warning/breach résolution. |
| Analytics     | Sept endpoints dashboard, workload et tendances de résolution.                           |
| Gouvernance   | Audit, settings globaux, catégories dynamiques et départements.                          |
| Rapports      | Données ticket/SLA, PDF asynchrones, notifications et téléchargement.                    |
| Observabilité | Correlation ID, logs, métriques, traces et health checks.                                |

## Limites restantes après fermeture des gates backend

| Besoin            | Support actuel                                    | Manque avant UI complète                                               |
| ----------------- | ------------------------------------------------- | ---------------------------------------------------------------------- |
| Recherche tickets | Scope, filtres, tri et recherche textuelle        | Recherche client, tolérance aux fautes et multi-tri avancé.            |
| Détail ticket     | Projection complète et compteurs                  | Pagination dédiée des timelines très volumineuses.                     |
| Pièces jointes    | Listing/upload/download/delete avec visibilité    | Preview, reprise d'upload et analyse antivirus.                        |
| SLA               | Première réponse et résolution séparées           | Explication historique, jours fériés et fuseaux configurables.         |
| Workload          | Capacité, disponibilité, absence, RR/least-loaded | Congés structurés, secours, justification détaillée et équité auditée. |
| Realtime          | Rooms utilisateur/département autorisées serveur  | Payloads versionnés, replay ou resynchronisation formalisée.           |
| Rapports async    | Création + notification finale                    | Statut individuel accessible au demandeur et progression normalisée.   |
| Préférences UI    | Settings globaux clé/valeur                       | Préférences utilisateur, rôle ou département avec schéma versionné.    |

## Absent : évolution backend obligatoire

### Client 360° télécom

- Entités client, compte, abonnement, produit et service.
- Couverture, zone géographique, QoS et incidents réseau corrélés.
- Contrat, segment, SLA client, churn et timeline d'interactions.

### Ticketing avancé

- Types de tickets et schémas de formulaires dynamiques.
- Champs conditionnels, détection de doublons et checklists.
- Cause racine, impact, urgence, problème connu et ticket récurrent.
- Tags contrôlés, macros, templates, réponses planifiées et bulk actions.
- Undo/compensation métier et fermeture avec règles configurables.

### SLA/OLA et workforce

- OLA internes, calendriers, jours fériés et fuseaux configurables.
- Contrats/segments, historique de pauses et explication de calcul.
- Prévision de breach, analyse causale et escalade automatique.
- Congés, remplacements, files de secours et allocation explicable.

### Opérations télécom

- Catalogue d'opérations sensibles.
- Re-authentification, double approbation et séparation des tâches.
- Suivi demandé/en file/exécuté/échoué/compensé.
- Incident majeur et rapport d'impact structuré.

### IA contrôlée

- Similarité de tickets, prochaines actions et notes de résolution.
- Confiance, provenance, évaluation, garde-fous PII et audit d'utilisation.

### Productivité avancée

- Recherche globale tolérante, filtres sauvegardés et suggestions.
- Workspace multi-onglets, layouts, brouillons, épingles et reprise de session.
- Colonnes configurables, groupements, exports génériques et cursor pagination.

## Découpage produit recommandé

1. **Release 1** : auth sécurisée, tickets, cycle de vie, collaboration, fichiers, notifications, realtime, dashboards, workload, audit, rapports et administration supportée.
2. **Release ultérieure** : workspace avancé et préférences, après validation utilisateurs.
3. **Lots métier dédiés avec backend préalable** : Client 360°, ticketing dynamique, SLA/OLA avancé, opérations télécom et IA.

## Règle de preuve

Une capacité n'est « supportée » que si modèle, route, RBAC, réponse typée, erreurs, tests négatifs et comportement runtime la prouvent. Une mention documentaire ou un bouton frontend ne suffit pas.
