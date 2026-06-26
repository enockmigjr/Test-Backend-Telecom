---
# yaml-language-server: $schema=schemas\page.schema.json
Object type:
    - Page
Creation date: "2026-06-19T10:16:57Z"
Created by:
    - Enock Junior
id: bafyreibuc345iuduu7cib6x5phpkvtj526uvhw4ocg3nmfdoxuuistegna
---
# Defi backend en NestJS   
## Exercice Backend Senior Express.js   
### Système de Gestion des Tickets d'Incidents Télécom (Trouble Ticket Management System)   
### Contexte Métier   
Une entreprise de télécom souhaite moderniser sa plateforme interne de Helpdesk. L'application est utilisée uniquement par les employés du Service Client (Customer Care), du NOC (Centre de Supervision Réseau), de la Facturation (Billing), du Support Technique (Technical Support) et des Opérations Terrain (Field Operations).   
Les représentants du service client créent des tickets au nom des clients. La plateforme devient le système central pour gérer les incidents jusqu'à leur résolution.   
### Objectif   
Construire le backend d'un Système de Gestion des Tickets d'Incidents Télécom en utilisant NestJs. Cette évaluation évalue l'architecture, la conception de la base de données et les compétences en ingénierie backend. Ne commencez pas à coder immédiatement.   
### Livrables   
Complétez le projet dans l'ordre suivant :   
1. Conception du Système (System Design)   
2. Conception de la Base de Données (Database Design)   
3. Conception de l'API REST (REST API Design)   
4. Implémentation du Backend   
   
### Phase 1 - Conception du Système   
Produisez un document de conception contenant : L'Architecture de Haut Niveau, l'Authentification & l'Autorisation, les Composants et Responsabilités, le Flux de Données, la Stratégie de Journalisation (Logging), la Stratégie de Gestion des Erreurs, le Diagramme de Déploiement, la Stratégie de Surveillance (Monitoring). Choisissez soit une architecture Monolithe Modulaire, soit une architecture Microservices, et justifiez votre décision.   
### Phase 2 - Conception de la Base de Données   
Concevez la base de données avant l'implémentation. Incluez un diagramme ER (Entité-Relation), les tables, les relations, les contraintes, les index, les champs d'audit, la stratégie de suppression douce (soft delete) et expliquez vos choix.   
### Phase 3 - Conception de l'API REST   
Concevez chaque point de terminaison (endpoint) avant l'implémentation. Incluez la méthode HTTP, l'URL, la requête (Request), la réponse (Response), les réponses d'erreur et l'autorisation.   
### Exigences Fonctionnelles   
### Authentification   
Authentification JWT avec Connexion (Login), Jeton de Rafraîchissement (Refresh Token) et Déconnexion (Logout).   
### Utilisateurs   
Prendre en charge au moins les rôles suivants : Administrateur, Superviseur, Agent du Service Client, Ingénieur NOC, Agent de Facturation, Technicien Terrain, Ingénieur du Support Technique. Concevez le modèle de permissions.   
### Tickets d'Incidents (Trouble Tickets)   
Concevez le modèle de ticket vous-même. Considérez des champs tels que le Numéro de Ticket, le Compte Client, le Type de Service, la Catégorie, la Priorité, la Sévérité, l'Équipe Assignée, l'Utilisateur Assigné, le SLA (Accord de Niveau de Service), la Résolution, la Cause Racine (Root Cause), Créé le (Created At) et Mis à jour le (Updated At).   
### Flux de Travail (Workflow)   
Concevez un cycle de vie de ticket approprié et définissez les transitions de statut valides.   
### Assignations   
Prendre en charge l'assignation, la réassignation, l'escalade et le transfert de propriété entre les départements.   
### Commentaires & Pièces Jointes   
Prendre en charge les commentaires publics, les notes internes et les pièces jointes de fichiers.   
### Historique   
Chaque action importante doit être auditable.   
### Recherche   
Implémentez le filtrage, le tri et la pagination. Concevez des capacités de recherche avancée.   
### Tableau de Bord (Dashboard)   
Concevez des points de terminaison (endpoints) pour les tableaux de bord opérationnels incluant : Les tickets par statut, les tickets par priorité, les tickets par département, le temps moyen de résolution, la conformité SLA, la charge de travail des agents.   
### Sécurité   
Implémentez la validation des requêtes, CORS, Helmet, la limitation de débit (rate limiting) et une gestion appropriée des erreurs.   
### Bonus   
Exemples : Mise en cache Redis, notifications WebSocket, notifications par e-mail, tâches planifiées (scheduled jobs), moteur de SLA, escalade automatique, Swagger/OpenAPI.   
### Contraintes Techniques   
**Obligatoire :** Node.js, NestJS, PostgreSQL, Docker, JWT, Migrations de Base de Données, Données Initiales (Seed Data). Choisissez votre ORM, bibliothèque de validation, journalisateur (logger) et framework de test préférés.   
### Évaluation   
L'évaluation se concentre sur : L'Architecture, la Conception de la Base de Données, la Conception de l'API, la Qualité du Code, l'Évolutivité (Scalability), la Maintenabilité, la Sécurité, les Tests, la Documentation.   
### Instructions   
Ne commencez PAS l'implémentation immédiatement. Rassemblez les hypothèses. Créez la conception du système. Concevez la base de données. Concevez l'API REST. Passez en revue votre architecture. C'est seulement après que vous commencerez l'implémentation.   
L'objectif est d'évaluer votre raisonnement et vos compétences en ingénierie backend plutôt que votre seule capacité à coder.   
