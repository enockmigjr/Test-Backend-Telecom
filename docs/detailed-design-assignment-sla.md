# Architecture Détaillée : Auto-Assignation & Gestion des SLA

Ce document fournit des explications approfondies sur les choix d'architecture et les mécanismes d'implémentation de la gestion des tickets et des SLA dans le système. Il sert de guide pour évaluer la conformité des développements par rapport aux exigences opérationnelles à forte volumétrie.

---

## 1. Cycle de Vie & Calcul des SLA

Pour garantir l'équité des indicateurs de performance (KPI) des agents, le calcul des SLA est divisé en deux phases distinctes :

```
Création du Ticket (created_at)
       │
       ├─► SLA de Premier Contact (S’égraine immédiatement)
       │   └─► Objectif : Garantir une prise en charge rapide par l'équipe.
       │
Passage à ASSIGNED ou IN_PROGRESS (assigned_at / start)
       │
       └─► SLA de Résolution (Démarre seulement à cet instant)
           └─► Objectif : Mesurer le temps de travail effectif de l'agent.
               (Pas de pénalisation de l'agent pour le temps passé en file d'attente NEW).
```

### Heures et Jours Ouvrables Dynamiques
Le calcul des échéances prend en compte le type de calendrier associé au ticket (24/7 pour les tickets critiques/hauts, Heures Ouvrables pour les autres) :
* **Horaires configurables** : Heures de début (`BUSINESS_HOURS_START`) et de fin (`BUSINESS_HOURS_END`) paramétrables en base de données.
* **Jours ouvrables configurables** : Liste des jours de la semaine (`BUSINESS_DAYS`, ex: `1,2,3,4,5` pour Lundi-Vendredi) paramétrable en base de données. 
* **Algorithme d'ajustement** : Si l'échéance calculée déborde de la plage ouvrable ou tombe un jour non ouvrable, la date est repoussée de façon récursive jusqu'au prochain jour ouvrable au début des heures de bureau (ex: passage du Vendredi 19h au Lundi 8h).

---

## 2. Cloisonnement Départemental (ABAC / Multi-Rôle)

Le système implémente un contrôle d'accès basé sur les attributs (ABAC) combiné au RBAC pour cloisonner les équipes :

* **Cloisonnement Départemental strict** : Un utilisateur d'un département donné (ex: *Billing*) ne peut visualiser ou modifier que les tickets rattachés à son département d'affectation (`departmentId`), sauf s'il possède le rôle global `ADMINISTRATOR`.
* **Scope Départemental des Superviseurs** : Les superviseurs (`SUPERVISOR`) gèrent uniquement les agents et les tickets de leur département d'affectation. Ils ne peuvent pas intervenir sur les départements tiers.
* **Exclusion de l'Administrateur** : Le rôle `ADMINISTRATOR` a un scope global et est affecté à un département `'Administration'` factice. Il est explicitement exclu du moteur d'auto-assignation automatique afin de ne jamais recevoir de tickets d'incident de support technique.
* **Assignations Manuelles Préservées** : L'auto-assignation n'empêche en aucun cas les autres flux d'assignation :
  * Auto-assignation manuelle par l'agent (sur un ticket non assigné de son département).
  * Assignation manuelle par le créateur du ticket (CS Agent), un superviseur ou un administrateur.

---

## 3. Moteur d'Auto-Assignation (Échelle et Volumétrie)

Le moteur d'assignation a été conçu pour gérer des centaines de milliers de tickets sans impacter les performances de la base de données PostgreSQL :

```
                          TICKET CRÉÉ / MODIFIÉ
                                   │
                                   ▼
                       Domain Event (EventEmitter2)
                                   │
                                   ▼
                        BullMQ assignment-queue
                                   │
                                   ▼
                            AssignmentWorker
                                   │
      ┌────────────────────────────┴────────────────────────────┐
      ▼                                                         ▼
[Étape A : Éligibilité]                                 [Étape B : Sélection]
 1. Charger la catégorie et le target_role               1. Exclure les agents inactifs/absents.
 2. Récupérer les agents possédant ce rôle               2. Vérifier la charge active de l'agent.
    dans le département du ticket.                         (activeCount < maxConcurrentTickets)
                                                         3. Calculer le score de charge pondéré
                                                            (workloadScore < maxWorkloadPerAgent)
                                                         4. Choisir la stratégie (ROUND_ROBIN / LEAST_LOADED)
                                                            et assigner de façon atomique (SELECT FOR UPDATE)
```

### Caractéristiques de Résistance à la Charge :
1. **Traitement Asynchrone (Chemin Nominal)** : Toute création ou modification de ticket déclenche un job dans BullMQ. Le traitement est délégué à des workers en arrière-plan pour ne pas bloquer l'API HTTP client.
2. **Cron de Résilience (Chemin Secondaire)** : Un cron s'exécute toutes les 2 minutes pour traiter les anomalies (tickets non assignés ou oubliés).
   * **LIMIT systématique** : Le cron ne charge jamais toute la table `tickets` mais traite les plus critiques en priorité par lots (`LIMIT 50`).
   * **Parallélisation contrôlée** : Traitement par groupes de 10 pour éviter les verrous longs ou les blocages de la base de données.
   * **Vue Matérialisée du Workload** : Pour éviter des requêtes d'agrégation SQL (`COUNT` + `SUM` group by) trop lourdes, la charge des agents est calculée en temps réel via une vue matérialisée `materialized_workload_view`. Le cron la rafraîchit en arrière-plan sans bloquer.

---

## 4. Routage Dynamique & Flexibilité des Catégories

* **Catégories en Base de Données** : Les catégories ne sont pas figées dans un `Enum` TypeScript mais stockées dans la table `categories`. L'ajout de nouvelles catégories par l'administrateur se fait à chaud via les endpoints `/api/v1/categories`.
* **Routage Rôle-Catégorie Dynamique** : Chaque catégorie en base possède une colonne `targetRole`. Le moteur d'assignation charge dynamiquement ce rôle pour filtrer les agents (ex: associer la catégorie 'Fibre Optique' au rôle 'FIELD_TECHNICIAN'). Aucun mappage n'est écrit en dur dans le code.

---

## 5. Gestion des Indisponibilités & Retour d'Absence

* **Désassignation d'Urgence** : Si un agent passe en statut inactif (déconnexion ou absence prolongée), le système identifie ses tickets actifs. Si un ticket présente un risque de dépassement de SLA de premier contact ou de résolution, le ticket est automatiquement désassigné (`assignedTo = null`, statut remis à `NEW` ou `ASSIGNED`).
* **Notification Handlebars & Emails** : Lors d'une désassignation d'urgence, un événement `ticket.deassigned` est émis. Un email utilisant le template Handlebars `ticket-deassigned.hbs` ainsi qu'une notification in-app sont immédiatement envoyés à l'agent concerné et aux superviseurs de son département.
* **Retour d'Absence** : Quand l'agent se reconnecte ou revient d'absence, son statut passe à disponible et il redevient éligible à la réception de nouveaux tickets par le moteur d'auto-assignation.
