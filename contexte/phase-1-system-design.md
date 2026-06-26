---
# yaml-language-server: $schema=schemas\page.schema.json
Object type:
    - Page
Creation date: "2026-06-19T17:10:34Z"
Created by:
    - Enock Junior
Links:
    - request_lifecycle_full
    - observability_stack
id: bafyreigbwipt63shhljzox2v4cuqmkcrqapajzev5apuqdesuiwgw4ojpi
---
# Phase 1 – System Design   
## 1. Introduction   
### Objectif   
Ce document présente la conception architecturale d'une plateforme de gestion des incidents télécoms développée en tant que service backend utilisant NestJS.
La plateforme permet à plusieurs départements au sein d'une entreprise de télécommunications de collaborer sur la résolution d'incidents clients, l'attribution de tickets, l'escalade, le suivi, l'audit et le reporting.
L'objectif de cette conception est de fournir un système backend sécurisé, évolutif, maintenable et observable tout en gardant l'architecture suffisamment simple pour un développement et un déploiement efficaces.   
## 2. Contexte Métier   
Les entreprises de télécommunications traitent une grande variété d'incidents clients allant des pannes réseau et des problèmes de connectivité aux litiges de facturation et aux demandes d'assistance technique.
Actuellement, les incidents impliquent souvent plusieurs équipes :   
- Service Client   
- Centre d'Opérations Réseau (NOC)   
- Facturation   
- Support Technique   
- Opérations Terrain
La plateforme centralise la gestion des incidents et fournit un flux de travail unifié pour le suivi des incidents tout au long de leur cycle de vie.   
   
## 3. Objectifs du Système   
La plateforme doit fournir :   
### Gestion des Incidents   
- Créer des incidents (tickets)   
- Attribuer des incidents à des équipes et des agents   
- Réattribuer des incidents si nécessaire   
- Escalader des incidents   
- Résoudre et clôturer des incidents   
   
### Collaboration   
- Notes internes   
- Commentaires publics   
- Pièces jointes   
- Historique des attributions   
   
### Sécurité   
- Authentification JWT   
- Rotation des jetons de rafraîchissement   
- Autorisation basée sur les rôles   
- Journalisation d'audit   
   
### Surveillance   
- Journaux d'application   
- Collecte de métriques   
- Traçage distribué   
- Surveillance de l'état de santé   
   
### Reporting   
- Statistiques des tickets   
- Conformité aux SLA   
- Charge de travail des agents   
- Performance des départements   
   
## 4. Exigences Fonctionnelles   
### Gestion des Utilisateurs   
Le système permettra aux administrateurs de :   
- Créer des utilisateurs   
- Activer ou désactiver des utilisateurs   
- Attribuer des départements   
- Attribuer des rôles   
   
### Authentification   
Le système fournira :   
- Connexion   
- Déconnexion   
- Rafraîchissement du jeton   
- Changement du mot de passe   
   
### Gestion des Tickets   
Le système permettra aux utilisateurs autorisés de :   
- Créer des tickets   
- Voir des tickets   
- Mettre à jour des tickets   
- Attribuer des tickets   
- Réattribuer des tickets   
- Escalader des tickets   
- Résoudre des tickets   
- Clôturer des tickets   
   
### Fonctionnalités de Collaboration   
Le système prendra en charge :   
- Commentaires internes   
- Commentaires publics   
- Pièces jointes   
- Historique des activités   
   
### Notifications   
Le système notifiera les utilisateurs lorsque :   
- Des tickets sont attribués   
- Des tickets sont escaladés   
- Des tickets sont résolus   
- Les seuils de SLA sont dépassés   
   
## 5. Exigences Non Fonctionnelles   
### Sécurité   
- Authentification basée sur JWT   
- Rotation des jetons de rafraîchissement   
- Hachage des mots de passe utilisant Argon2   
- Contrôle d'accès basé sur les rôles   
- Piste d'audit pour les actions critiques   
   
### Évolutivité   
Le système doit prendre en charge la croissance future sans nécessiter une refonte complète.   
### Fiabilité   
La plateforme doit préserver l'historique des tickets et l'historique des attributions à tout moment.   
### Maintenabilité   
La logique métier doit être isolée et organisée en modules indépendants.   
### Observabilité   
Le système doit fournir :   
- Des journaux structurés   
- Des métriques   
- Des traces   
- Des vérifications de l'état de santé   
   
## 6. Style Architectural   
### Architecture Choisie   
J'opte pour un **Modular Monolith** plutôt que des Microservices, .   
L'application est un outil **interne** utilisé par des employés de cinq départements. Il n'y a pas de besoin de scaling indépendant par fonctionnalité, pas de teams séparées qui doivent déployer indépendamment. Si demain le besoin de scaler le moteur de tickets indépendamment se présente, l'extraction en microservice est facilitée parce que les frontières sont déjà propres.   
### Justification   
L'application contient plusieurs domaines métier mais reste une unité déployable unique.
Avantages :   
- Déploiement plus simple   
- Complexité opérationnelle moindre   
- Tests plus faciles   
- Débogage plus facile   
- Frontières de domaine claires
Les microservices ont été intentionnellement évités car ils introduiraient une complexité d'infrastructure inutile pour le périmètre actuel du projet.   
   
## 7. Architecture Haut Niveau   
```
│   Client      │
└──────┬──────┘
       │ HTTPS
       ▼
┌─────────────┐
│    Nginx      │
└──────┬──────┘
        │
        ▼
┌─────────────────────────┐
│       API NestJS             │
└───────────┬─────────────┘
            │
            ├──────── PostgreSQL
            │
            ├──────── Redis
            │
            ├──────── BullMQ
            │
            └──────── Pile d'Observabilité


```
## 8. Pile Technologique   
|                     Couche   <br> |           Technologie   <br> |
|:----------------------------------|:-----------------------------|
|          Framework Backend   <br> |                NestJS   <br> |
|            Base de données   <br> |            PostgreSQL   <br> |
|                        ORM   <br> |           Drizzle ORM   <br> |
|                      Cache   <br> |                 Redis   <br> |
|  Système de File d'attente   <br> |                BullMQ   <br> |
|           Authentification   <br> |                   JWT   <br> |
|                 Validation   <br> |       class-validator   <br> |
|          Documentation API   <br> |       Swagger/OpenAPI   <br> |
|             Journalisation   <br> |                  Pino   <br> |
|               Surveillance   <br> |            Prometheus   <br> |
|                    Traçage   <br> | OpenTelemetry + Tempo   <br> |
|     Agrégation de journaux   <br> |                  Loki   <br> |
|              Visualisation   <br> |               Grafana   <br> |
|              Reverse Proxy   <br> |                 Nginx   <br> |
|           Conteneurisation   <br> |        Docker Compose   <br> |

## 9. Modules Domaine   
L'application est divisée en modules métier indépendants.   
### Module Auth   
Responsabilités :   
- Authentification   
- Rafraîchissement du jeton   
- Gestion des mots de passe   
   
### Module Utilisateurs   
Responsabilités :   
- Gestion des utilisateurs   
- Attribution des départements   
- Attribution des rôles   
   
### Module Tickets   
Responsabilités :   
- Cycle de vie des tickets   
- Propriété des tickets   
- Mises à jour des tickets   
   
### Module Attributions   
Responsabilités :   
- Suivi des attributions   
- Historique des réattributions   
- Suivi des escalades   
   
### Module Commentaires   
Responsabilités :   
- Commentaires publics   
- Notes internes   
   
### Module Pièces Jointes   
Responsabilités :   
- Téléversements de fichiers   
- Gestion des pièces jointes   
   
### Module Notifications   
Responsabilités :   
- Notifications par e-mail   
- Notifications dans l'application   
   
### Module SLA   
Responsabilités :   
- Surveillance des SLA   
- Détection des violations   
- Déclencheurs d'escalade   
   
### Module Audit   
Responsabilités :   
- Suivi des activités   
- Journaux de conformité   
   
### Module Tableau de Bord   
Responsabilités :   
- Statistiques   
- Reporting   
- KPI   
   
## 10. Départements   
La plateforme prend en charge les départements suivants :   
- Administration   
- Service Client   
- NOC   
- Facturation   
- Support Technique   
- Opérations Terrain
Chaque utilisateur appartient à exactement un département.   
   
## 11. Rôles   
La plateforme prend en charge les rôles suivants :   
- Administrateur   
- Superviseur   
- Agent du Service Client   
- Ingénieur NOC   
- Agent de Facturation   
- Ingénieur Support Technique   
- Technicien Terrain
Chaque utilisateur a exactement un rôle.   
   
## 12. Architecture de Sécurité   
### Authentification   
L'authentification est basée sur :   
- Jeton d'accès (JWT)   
- Rotation des jetons de rafraîchissement   
   
### Sécurité des Mots de Passe   
Les mots de passe sont stockés en utilisant :   
- Hachage Argon2   
   
### Sécurité des Sessions   
Les jetons de rafraîchissement sont :   
- Hachés avant le stockage   
- Associés à l'adresse IP   
- Associés à l'User-Agent   
- Révocables individuellement   
   
### Autorisation   
L'autorisation est implémentée en utilisant RBAC.
Les vérifications de rôles sont appliquées via les Gardes NestJS.   
## 13. Cycle de Vie des Tickets   
```
New  
│
  ▼
ASSIGNÉ
  │
  ▼
EN COURS
  │
  ├────────► EN ATTENTE CLIENT
  │
  └────────► EN ATTENTE TIERCE PARTIE
                    │
                    ▼
               EN COURS
                    │
                    ▼
                RÉSOLU
                    │
            ┌───────┴───────┐
            ▼               ▼
         FERMÉ         ROUVERT
                             │
                             ▼
                        EN COURS


```
Le statut d'un ticket suit un lifecycle strict. Les statuts sont : `NEW` → `ASSIGNED` → `IN\_PROGRESS` → `PENDING\_CUSTOMER` → `PENDING\_THIRD\_PARTY` → `RESOLVED` → `CLOSED`. On peut aussi avoir `REOPENED` (depuis RESOLVED ou CLOSED) et `CANCELLED`.   
Les transitions valides sont définies dans le Domain Layer comme une map immuable. Par exemple `NEW` peut aller vers `ASSIGNED` ou `CANCELLED`. `ASSIGNED` peut aller vers `IN\_PROGRESS` ou `REASSIGNED` (qui retourne à `ASSIGNED` avec un nouvel assigné). `IN\_PROGRESS` peut aller vers `PENDING\_CUSTOMER`, `PENDING\_THIRD\_PARTY`, `RESOLVED`. `RESOLVED` peut aller vers `CLOSED` ou `REOPENED`. Toute tentative de transition invalide lève une `InvalidStatusTransitionException` avec le statut actuel et les transitions valides dans le message d'erreur.   
Les opérations suivantes sont traitées comme des événements plutôt que comme des statuts :   
- Escaladé   
- Réattribué   
- Transféré
Ces événements sont stockés dans l'historique des tickets.   
   
   
## 14. Cycle de traitement d'une requête (Request Lifecycle)   
Afin de garantir la sécurité, la maintenabilité et la traçabilité des opérations, chaque requête suit un pipeline de traitement clairement défini.   
### Flux général   
```
Client
   │
   ▼
Nginx
   │
   ▼
Middleware
   │
   ▼
Guards
   │
   ▼
Interceptors (entrée)
   │
   ▼
Validation Pipes
   │
   ▼
Controller
   │
   ▼
Service
   │
   ▼
Repository / Drizzle ORM
   │
   ▼
PostgreSQL
   │
   ▼
Interceptors (sortie)
   │
   ▼
Réponse HTTP


```
### Flux complet d'une requête — Niveau de détail maximum   
Prenons le cas concret : **un Customer Service Agent crée un ticket CRITICAL.**   
`POST /api/v1/tickets` avec un Bearer token et un body JSON.   
**Étape 1 — TCP et HTTP**   
La requête TCP arrive sur le port 443 de Nginx. Nginx termine le TLS (déchiffrement). Il vérifie les headers de base et applique ses propres rate limits (connexions simultanées par IP). Il ajoute les headers `X-Forwarded-For` et `X-Real-IP`. Il proxy la requête vers le conteneur NestJS sur le port interne 3000.   
**Étape 2 — Middleware NestJS**   
La première chose qui s'exécute est le middleware `CorrelationIdMiddleware`. Il lit le header `X-Correlation-Id` si présent (utile pour tracer une requête initiée par un système externe), sinon génère un UUID frais. Il attache ce `correlationId` à l'objet `request` et le stocke dans `AsyncLocalStorage`. Tout ce qui se passe dans le contexte de cette requête, dans n'importe quel Service appelé profondément dans la stack, peut accéder à ce `correlationId` sans qu'on ait besoin de le passer en paramètre partout. Il ajoute aussi `X-Correlation-Id` dans les headers de réponse pour que le client puisse le logger côté front.   
Ensuite le middleware `RequestLoggerMiddleware` loggue l'entrée de la requête avec Pino : `{ level: 'info', message: 'Incoming request', method: 'POST', url: '/api/v1/tickets', correlationId: '...', ip: '...',  userAgent: '...' }`.   
**Étape 3 — Guards**   
NestJS exécute les guards dans l'ordre dans lequel ils sont enregistrés.   
`JwtAuthGuard` s'exécute en premier. Il extrait le Bearer token du header `Authorization`. Il vérifie la signature du token avec la clé secrète JWT. Si la signature est invalide ou le token expiré, il lance immédiatement une `UnauthorizedException` — le flux s'arrête là, les étapes suivantes ne s'exécutent pas. Si le token est valide structurellement, il extrait le payload ( `sub`, `email`, `role`, `departmentId`, `jti`). Il vérifie dans Redis si le `jti` figure dans la liste des tokens révoqués. Si oui, `UnauthorizedException`. Il charge l'utilisateur complet depuis PostgreSQL (ou le cache Redis) et l'attache à `request.user`. Le Guard retourne `true`, le flux continue.   
`RolesGuard` s'exécute ensuite. Il lit les métadonnées de la route via `Reflector` pour savoir quels rôles sont autorisés sur cet endpoint. Il compare avec `request.user.role`. Si le rôle n'est pas dans la liste, `ForbiddenException`. Ici, l'endpoint de création de ticket autorise `CUSTOMER\_SERVICE\_AGENT`, `ADMIN`. Notre utilisateur est `CUSTOMER\_SERVICE\_AGENT`, ça passe.   
**Étape 4 — Pipes**   
`ValidationPipe` s'exécute. Il prend le body JSON brut et tente de l'hydrater dans la classe `CreateTicketDto`. `class-transformer` convertit les types (strings vers enums, strings vers dates). `class-validator` exécute toutes les validations déclarées : `@IsNotEmpty()`, `@IsEnum(TicketPriority)`, `@MaxLength(500)`, `@IsOptional()`, etc.   
Si une validation échoue, `ValidationPipe` lance une `BadRequestException` avec le détail de toutes les erreurs de validation dans un tableau structuré. Le `GlobalExceptionFilter` intercepte ça et formate une réponse 400 avec `{ success: false, error: { code: 'VALIDATION\_ERROR', message: 'Validation failed', details: [{ field: 'priority', message: 'priority must be a valid enum value' }] } }`.   
Si tout est valide, `ValidationPipe` retourne un objet `CreateTicketDto` propre et typé.   
**Étape 5 — Controller**   
`TicketsController.create()` reçoit le `CreateTicketDto` validé et `request.user` (l'utilisateur authentifié). Le Controller ne fait **aucune logique métier**. Il appelle simplement `this.ticketsService.create(createTicketDto, currentUser)` et `return` le résultat. C'est tout.   
**Étape 6 — Service (cœur de la logique métier)**   
`TicketsService.create()` s'exécute .   
Il génère le `ticket\_number` avec le format INC-2026-000001. Ce numéro est généré via une sequence PostgreSQL ou une fonction qui récupère et incrémente atomiquement le compteur pour éviter les doublons en cas de requêtes concurrentes.   
Il consulte `SlaService.calculateDueDate(priority)`. Ce service lit la `sla\_policy` correspondante à la priorité CRITICAL depuis le cache Redis (ou PostgreSQL si cache miss). Une priorité CRITICAL a par exemple un `resolution\_time\_minutes` de 240 (4 heures). `sla\_due\_at` est donc `NOW() + 240 minutes`.   
Il crée l'entité Ticket avec tous les champs, `status = 'NEW'`, `sla\_breached = false`.   
Il persiste le ticket via `ticketRepository.save(ticket)` dans la transaction en cours.   
Il crée le premier enregistrement d'historique via `historyRepository.save({ ticket\_id, action: 'CREATED', new\_value: { ...ticketSnapshot }, performed\_by: currentUser.id })`.   
Il émet un Domain Event `TicketCreatedEvent` via le `EventEmitter2` de NestJS. Les listeners de cet événement sont asynchrones et ne bloquent pas la transaction.   
Il commit la transaction. Si n'importe quelle étape précédente échoue, le `rollback()` est appelé dans le bloc `catch` et une exception appropriée est relancée.   
**Étape 7 — Domain Events asynchrones**   
Après le commit, les listeners du `TicketCreatedEvent` s'exécutent de façon asynchrone, découplée du flux HTTP principal.   
`NotificationListener` reçoit l'event. Il appelle `NotificationsService` qui ajoute un job dans la queue BullMQ `email-queue` avec le payload `{ type: 'TICKET\_CREATED', ticketId, agentId, priority: 'CRITICAL' }`. Il appelle aussi `WebSocketGateway.emitToRoom(departmentId, 'ticket.created', ticketSummary)` pour notifier les supervisors connectés en temps réel et autre.   
`SlaEngineListener` reçoit l'event. Pour les tickets CRITICAL, il peut programmer une alerte préventive dans BullMQ Scheduler pour envoyer une warning quand 80% du SLA est consommé.   
**Étape 8 — Interceptors**   
`LoggingInterceptor` calcule le `responseTime` (temps depuis le début de la requête) et loggue la sortie : `{ level: 'info', message: 'Request completed', method: 'POST', url: '/api/v1/tickets', statusCode: 201, responseTimeMs: 47, userId: '...', correlationId: '...', ticketId: '...' }`.   
`TransformInterceptor` prend ce que le Controller a retourné et le wrap dans la structure de réponse standard : `{ success: true, data: { ...ticketObject } }`.   
**Étape 9 — Réponse HTTP**   
NestJS sérialise la réponse en JSON. Il ajoute les headers de sécurité configurés par Helmet : `X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security`, `Content-Security-Policy`. Il ajoute `X-Correlation-Id` pour que le client puisse tracer. Il envoie la réponse 201 Created avec le body JSON.   
**Étape 10 — Traitement parallèle et asynchrone**   
Pendant que la réponse 201 est déjà arrivée chez le client, plusieurs choses se passent en arrière-plan. Le worker BullMQ process le job email et envoie un email de confirmation à l'agent. Si c'est un ticket CRITICAL, il envoie aussi un email d'alerte au Supervisor. Les métriques Prometheus sont mises à jour ( `tickets\_created\_total{priority="CRITICAL"}++`). OpenTelemetry ferme le Span de la requête et envoie la trace à Jaeger.   
**Ce que le client reçoit**   
```
HTTP 201 Created
X-Correlation-Id: 550e8400-e29b-41d4-a716-446655440000
Content-Type: application/json

{
  "success": true,
  "data": {
    "id": "...",
    "ticket_number": "TT-2025-0001247",
    "title": "...",
    "status": "NEW",
    "priority": "CRITICAL",
    "sla_due_at": "2025-01-15T14:30:00Z",
    "sla_breached": false,
    "created_at": "2025-01-15T10:30:00Z"
  }
}


```
Le `correlationId` dans le header permet au frontend de l'afficher dans ses propres logs, et à l'équipe technique de retrouver absolument tout ce qui s'est passé côté serveur pour cette requête spécifique — de Nginx à PostgreSQL — en une seule recherche.   
Le flux complet d'une requête `POST /api/v1/tickets` avec tous les outils nommés à chaque étape.   
[Voir le fichier svg ou png](files\request_lifecycle_full.svg)   
### Rôle de chaque couche   
### Nginx   
Responsabilités :   
- Terminaison TLS   
- Reverse Proxy   
- Compression HTTP   
- Gestion des en-têtes de sécurité   
- Limitation du débit (Rate Limiting)   
- Protection contre certaines attaques automatisées   
   
### Middleware   
Responsabilités :   
- Génération du Correlation ID   
- Journalisation des requêtes   
- Extraction des informations de contexte   
   
### Guards   
Responsabilités :   
- Vérification du JWT   
- Vérification des rôles   
- Contrôle d'accès aux ressources   
   
Exemples :   
- Un agent NOC ne peut pas gérer les utilisateurs.   
- Un agent Billing ne peut pas modifier un ticket clôturé.   
   
### Validation Pipes   
Responsabilités :   
- Validation des DTO   
- Transformation des données   
- Rejet des requêtes invalides   
   
### Controllers   
Responsabilités :   
- Réception des requêtes HTTP   
- Appel des services applicatifs   
- Retour des réponses standardisées   
   
### Services   
Responsabilités :   
- Implémentation des règles métier   
- Coordination entre les modules   
- Gestion des transactions   
   
### Repositories (Drizzle ORM)   
Responsabilités :   
- Accès à PostgreSQL   
- Construction des requêtes SQL   
- Persistance des données   
 --- 
   
## 15. Architecture de l'observabilité   
L'observabilité est essentielle pour comprendre le comportement du système en production.   
L'objectif est de pouvoir répondre rapidement aux questions suivantes :   
- Pourquoi une requête est-elle lente ?   
- Pourquoi un ticket n'a-t-il pas été assigné ?   
- Pourquoi un SLA a-t-il été dépassé ?   
- Pourquoi une erreur s'est-elle produite ?   
   
### Architecture retenue   
```
Application NestJS
        │
        ├──────── Logs → Loki
        │
        ├──────── Metrics → Prometheus
        │
        └──────── Traces → Tempo
                       │
                       ▼
                    Grafana


```
### Logs   
Les logs sont générés à l'aide de Pino.   
Chaque log inclut systématiquement un `correlationId` (généré par un middleware à l'entrée et propagé dans tout le contexte de la requête via `AsyncLocalStorage`), le `userId` et `userRole` si authentifié, le `method` et `url`, le `statusCode` et `responseTime`, et le `module` NestJS source.   
Les niveaux de log sont `error` pour les exceptions non gérées et erreurs critiques, `warn` pour les tentatives d'accès non autorisées et violations de rate limit, `info` pour les actions métier importantes (création ticket, changement de statut, assignation), et `debug` pour les queries SQL et détails de débogage en dev.   
Chaque événement important est journalisé :   
- Connexion utilisateur   
- Création de ticket   
- Réassignation   
- Escalade   
- Erreurs applicatives   
   
Exemple :   
```
{
  "level": "info",
  "message": "Ticket assigned",
  "ticketId": "TK-2026-00125",
  "assignedTo": "user-12",
  "correlationId": "abc123"
}


```
### Métriques   
On expose un endpoint `/health` (liveness) et `/health/ready` (readiness) via `@nestjs/terminus` qui vérifient la connexion PostgreSQL, Redis, et la mémoire disponible. Notifications vers Slack ou email.   
Pour les métriques, on intègre `prom-client` et on expose `/metrics` pour Prometheus. Ces métriques alimentent des dashboards Grafana et des alertes PagerDuty.   
Prometheus collecte notamment :   
- Nombre de requêtes HTTP   
- Temps de réponse   
- Nombre d'erreurs   
- Utilisation CPU   
- Utilisation mémoire   
- Nombre de tickets créés   
   
### Traces distribuées   
OpenTelemetry permet de suivre une requête complète :   
```
Requête HTTP
   │
   ▼
Controller
   │
   ▼
Service
   │
   ▼
PostgreSQL


```
Chaque étape est mesurée afin d'identifier les goulots d'étranglement.   
### Visualisation   
Grafana centralise :   
- Dashboards applicatifs   
- Dashboards métier   
- Logs   
- Traces   
- Alertes   
 --- 
   
   
Voici d'abord le schéma de la stack d'observabilité, puis le flux complet de la requête.   
[voir le fichier svg ou png](files\observability_stack.svg)   
## 16. Stratégie de cache   
Redis est utilisé pour réduire la charge sur PostgreSQL et améliorer les performances.   
Redis joue deux rôles dans ce système et il est important de ne pas les mélanger.   
**Cache applicatif**   
Les données des dashboards sont coûteuses à calculer (agrégations sur des milliers de tickets). On cache le résultat avec une TTL de 60 secondes pour les métriques temps réel, 5 minutes pour les rapports. La stratégie est Cache-Aside : le Service vérifie Redis, si miss il calcule depuis PostgreSQL et écrit dans Redis. À chaque modification de ticket (changement de statut, nouvelle assignation), on invalide les clés de cache concernées.   
Les listes de référence (départements, politiques SLA, rôles disponibles) changent rarement. On les cache avec une TTL de 10 minutes et on invalide explicitement quand un Admin les modifie.   
**Gestion des tokens révoqués et rate limiting**   
Quand un utilisateur se déconnecte, on inscrit son `jti` (JWT ID) dans un Set Redis avec une expiration égale à la durée de vie restante du access token. Le `JwtAuthGuard` vérifie à chaque requête si le `jti` est dans cette liste. C'est plus léger que de stocker tous les tokens valides, on stocke seulement les tokens révoqués avant expiration.   
Pour le rate limiting, `@nestjs/throttler` avec le storage Redis permet un rate limiting distribué qui fonctionne même si tu as plusieurs instances de l'API derrière un load balancer. La configuration est : 100 requêtes par 15 minutes par IP pour les routes publiques, 10 tentatives de login par heure par IP, pas de limite (ou limite très haute) pour les routes internes authentifiées.   
### Cas d'utilisation   
### Sessions JWT   
Stockage :   
- Révocation des refresh tokens   
- Blacklist JWT   
   
### Données fréquemment consultées   
Exemples :   
- Départements   
- Paramètres SLA   
- Configuration système   
   
### Limitation du débit   
Redis stocke les compteurs utilisés pour :   
- Login   
- Réinitialisation de mot de passe   
- Endpoints sensibles   
 --- 
   
## 17. Traitement asynchrone   
Certaines opérations ne doivent pas ralentir les requêtes utilisateur.   
BullMQ est utilisé pour exécuter ces tâches en arrière-plan.   
### Files de traitement   
### Notifications Email   
Exemples :   
- Création de compte   
- Réinitialisation du mot de passe   
- Affectation de ticket   
   
### Vérification des SLA   
Exemples :   
- Première réponse dépassée   
- Résolution dépassée   
   
### Escalade automatique   
Si un SLA est dépassé :   
```
Ticket
    │
    ▼
Escalade automatique
    │
    ▼
Notification du superviseur


```
   
On utilise `@nestjs/websockets` avec Socket.io. Quand un agent est connecté sur le dashboard, il s'abonne à un room correspondant à son identité et ses départements. Les événements émis sont : `ticket.created`, `ticket.status\_changed`, `ticket.assigned\_to\_you`, `ticket.comment\_added`, `ticket.sla\_warning` (quand il reste 20% du temps SLA), `ticket.sla\_breached`.   
Le Gateway Socket.io vérifie le JWT à la connexion via un middleware Socket.io. L'émission d'événements se fait depuis les Services via un `NotificationsService` injecté partout. Ce service expose une méthode `emit(userId, event, payload)` et `emitToRoom(departmentId, event, payload)`. Pour les utilisateur non connecter, on stock en base   
On utilise `@nestjs-modules/mailer` avec Nodemailer en transport. Les templates d'email sont en Handlebars pour séparer le contenu de la logique. Les emails sont envoyés en asynchrone via une queue BullMQ (BullMQ + Redis) pour ne pas bloquer le thread principal. Les cas d'envoi d'email sont : nouveau ticket créé (confirmation à l'agent créateur), ticket assigné (notification à l'assigné), ticket escaladé (notification au supervisor et nouvel assigné), SLA breach (notification au supervisor et à l'assigné), ticket résolu (notification à l'agent créateur).   
On ne bloque jamais une requête HTTP pour envoyer un email. La requête se termine, l'événement Domain est émis, un listener l'intercepte et ajoute un job dans la queue Bull. Le worker process le job en arrière-plan.   
Le SLA Engine tourne comme un job planifié via `@nestjs/schedule` (qui utilise node-cron). Toutes les 5 minutes, il exécute une query SQL ciblée sur les tickets actifs dont `sla\_due\_at` est dans le futur proche ou passé.   
La query récupère tous les tickets avec `status NOT IN ('RESOLVED', 'CLOSED', 'CANCELLED')` et `sla\_due\_at <= NOW() + INTERVAL '30 minutes'`. Pour chaque ticket en warning (20% du temps restant), il émet un event `ticket.sla\_warning`. Pour chaque ticket en breach (sla\_due\_at dépassé et sla\_breached = false), il met à jour `sla\_breached = true`, insère un enregistrement dans `ticket\_history` avec l'action `SLA\_BREACHED`, émet une notification WebSocket et un email au supervisor, et selon la configuration, peut déclencher une escalation automatique.   
L'escalation automatique consulte la table `sla\_policies` pour savoir si cette priorité a une escalation automatique configurée, puis appelle le même `AssignmentsService` qu'un humain utiliserait pour escalader.   
 --- 
## 18. Gestion des fichiers   
Les pièces jointes sont stockées séparément des données métier.   
### Version initiale   
Stockage local :   
```
/storage
    /tickets
        /2026


```
La base de données stocke uniquement :   
- Nom du fichier   
- Type MIME   
- Taille   
- Emplacement   
   
### Évolution future   
Le système pourra migrer vers :   
- Amazon S3   
- MinIO   
- Azure Blob Storage   
   
sans modification majeure du modèle de données.   
 --- 
## 19. Stratégie de sécurité   
La sécurité constitue une exigence fondamentale du système.   
### Authentification   
Mécanismes retenus :   
- JWT Access Token   
- Refresh Token Rotation   
- Révocation des sessions   
   
### Stockage des mots de passe   
Les mots de passe sont protégés avec :   
```
Argon2id


```
Les mots de passe ne sont jamais stockés en clair.   
### Protection des API   
Mesures mises en place :   
- Validation stricte des entrées   
- DTO NestJS   
- Sanitization des données   
- Rate Limiting   
- Headers de sécurité   
   
### Journalisation de sécurité   
Les événements suivants sont audités :   
- Connexions   
- Déconnexions   
- Changement de mot de passe   
- Création d'utilisateur   
- Modification des rôles   
- Escalades critiques   
   
### Gestion des permissions   
Le système applique le principe du moindre privilège.   
Chaque utilisateur possède uniquement les droits nécessaires à son activité.   
 --- 
## 20. Gestion des erreurs   
Toutes les erreurs sont centralisées grâce à un Global Exception Filter.   
NestJS a un système d'exception filters. On crée un `GlobalExceptionFilter` qui intercepte toutes les exceptions et les transforme en réponses structurées uniformes. La structure de réponse d'erreur est toujours `{ success: false, error: { code, message, details?, correlationId, timestamp } }`.   
On distingue les **erreurs opérationnelles** (erreurs prévisibles : ticket non trouvé, permission refusée, validation échouée) des **erreurs de programmation** (bugs imprévus). Les erreurs opérationnelles retournent le bon HTTP status code avec un message clair. Les erreurs de programmation loggent le stack trace complet, alertent le monitoring, et retournent un 500 générique sans exposer les internals.   
On définit des exceptions métier custom : `TicketNotFoundException`, `InvalidStatusTransitionException`, `SlaBreachException`, `UnauthorizedTicketAccessException`, etc. Chacune hérite de `HttpException` et porte un code d'erreur applicatif typé.   
### Format de réponse standard   
```
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Un ou plusieurs champs de la requête sont invalides.",
    "details": {
      "title": "Le titre est requis et doit comporter au moins 5 caractères.",
      "priority": "La priorité doit être 'LOW', 'MEDIUM' ou 'HIGH'.",
      "departmentId": "L'identifiant du département doit être un UUID valide."
    },
    "correlationId": "b2c3d4e5-f6a7-8901-bcde-f23456789012",
    "timestamp": "2026-06-22T14:35:20.789Z"
  }
}


```
### Avantages   
- Réponses cohérentes   
- Débogage facilité   
- Expérience développeur améliorée   
 --- 
   
## 21. Architecture de déploiement   
Le système est conçu pour être déployé à l'aide de Docker Compose.   
L'infrastructure est entièrement conteneurisée avec Docker. On a un **Nginx** en reverse proxy qui termine le TLS et load balance vers les instances NestJS. Les conteneurs NestJS sont stateless (ce qui facilite le scaling horizontal). PostgreSQL tourne avec un volume persistant. Redis sert à la fois pour le cache et pour le stockage des sessions de refresh token révoquées.   
Pour Docker Compose en développement : `nginx`, `api` (NestJS), `postgres`, `redis`. En production : on utilise les mêmes images mais avec des variables d'environnement de prod, des secrets gérés via Docker Secrets ou un vault.   
### Services   
```
Nginx
 │
 ├── NestJS API
 │
 ├── PostgreSQL
 │
 ├── Redis
 │
 ├── Prometheus
 │
 ├── Loki
 │
 ├── Tempo
 │
 └── Grafana


```
### Avantages   
- Déploiement reproductible   
- Isolation des services   
- Facilité de maintenance   
- Évolutivité future vers Kubernetes   
 --- 
   
## 22. Évolutions futures   
L'architecture a été conçue pour permettre plusieurs évolutions :   
- Migration vers Kubernetes   
- Stockage objet (S3/MinIO)   
- Microservices ciblés si nécessaire   
- Authentification SSO (OAuth2, OpenID Connect)   
- Intégration avec des systèmes CRM   
- Intégration avec des outils de supervision réseau   
- Analyse prédictive des incidents   
 --- 
   
## 23. Conclusion   
L'architecture proposée répond aux besoins d'une plateforme moderne de gestion d'incidents télécoms.   
Le choix d'un Modular Monolith basé sur NestJS permet de conserver un excellent équilibre entre simplicité opérationnelle, maintenabilité et évolutivité.   
L'intégration de PostgreSQL, Redis, BullMQ, Drizzle ORM, OpenTelemetry et de la stack Grafana fournit une base robuste, sécurisée et observable capable de supporter les besoins actuels tout en préparant les évolutions futures de la plateforme.   
