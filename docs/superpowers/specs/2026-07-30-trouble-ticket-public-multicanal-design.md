# Trouble ticket public et multicanal — spécification d’architecture

Statut : design validé, implémentation non commencée
Date : 2026-07-30

## 1. Décision

Le système évolue en passerelle de support public multicanale au sein du monolithe NestJS existant. Le ticket reste l’unique source de vérité. Le frontend interne, son BFF et son authentification ne sont ni remplacés ni exposés aux visiteurs.

Une application publique indépendante fournit un portail complet et un widget chargé dans une iframe. Les canaux WordPress, puis WhatsApp ou d’autres canaux, se branchent par adaptateurs sur les mêmes cas d’usage applicatifs.

## 2. État actuel et contraintes

- `tickets.createdBy`, les auteurs de commentaires et les acteurs d’historique référencent actuellement un utilisateur interne obligatoire.
- La visibilité, l’affectation, les notifications et le WebSocket actuels sont conçus pour les sept rôles internes.
- Le DTO interne de création exige des champs d’organisation que le public ne doit ni connaître ni imposer.
- Le frontend interne Next.js utilise un BFF, des cookies HttpOnly et une protection CSRF.
- PhotoVault sépare le thème de présentation et trois plugins actifs portant les règles métier.
- Les copies de plugins présentes dans le thème sont des miroirs de distribution, pas la source exécutée.
- WordPress Core et les trois plugins existants ne doivent pas être couplés au ticketing.

## 3. Objectifs

- Permettre à une personne sans compte interne de créer et suivre ses demandes.
- Éviter les vérifications répétées tout en conservant une autorisation sûre.
- Fournir un bot utile sans rendre la création dépendante de l’IA.
- Intégrer PhotoVault sans régression ni conflit CSS ou JavaScript.
- Préparer de nouveaux canaux sans dupliquer le métier ticket.
- Garantir l’historique, le SLA et la livraison des réponses externes.

## 4. Hors périmètre initial

- Microservices, nouveau courtier d’événements ou moteur de règles générique.
- Base vectorielle avant preuve de besoin.
- Compte obligatoire pour un demandeur externe.
- Fusion automatique d’identités provenant de plusieurs intégrations.
- CSS ou JavaScript arbitraire fourni par un site intégrateur.

## 5. Contexte cible

```text
Widget / Portail / WordPress / futur WhatsApp
                    |
          Adaptateurs publics de canal
                    |
     Identité + conversation + admission
                    |
        Services métier des tickets
                    |
       Historique + SLA + boîte d’envoi
                    |
     Notifications internes et externes
```

Le backend reste un monolithe modulaire. Les nouvelles frontières sont des modules et interfaces internes, pas des services réseau supplémentaires.

## 6. Modèle d’acteur et données

Trois acteurs explicites existent : `INTERNAL`, `EXTERNAL_REQUESTER` et `SYSTEM`. Aucun faux utilisateur technique ne représente un visiteur.

Un ticket peut porter `openedByUserId` lorsqu’un agent ouvre une demande, `requesterId` pour le client concerné, ou les deux. Une création publique porte un demandeur sans acteur interne.

Les commentaires, messages publics et entrées d’historique enregistrent le type d’acteur et la référence compatible, avec contraintes SQL empêchant les combinaisons incohérentes.

Nouvelles entités principales :

- `support_integrations` : origines, apparence, routage, quotas, politiques et fonctions activées ;
- `external_requesters` et `external_identities` : profil et identités vérifiées, cloisonnés par intégration ;
- `trusted_devices` : jeton opaque haché, expiration, révocation et version de politique ;
- `support_conversations` et `support_messages` : échange antérieur et postérieur à la création ;
- `external_deliveries` : tentatives et résultat par canal ;
- `outbox_events` : événements à distribuer de manière fiable.

Le ticket reçoit l’intégration, le demandeur et le canal source. Les notifications internes actuelles restent séparées des livraisons externes.

Avant la création, `support_messages` porte le contenu conversationnel. Après rattachement à un ticket, `ticket_comments`, étendu aux acteurs externes, reste la source métier des réponses publiques ; le message de transport ne conserve qu’un lien et les métadonnées du canal. Le portail agrège les deux périodes sans dupliquer le contenu.

## 7. Identité publique et sessions

Le contact est vérifié à la première utilisation. Un appareil de confiance est ensuite valable 90 jours par défaut et renouvelable. La durée est administrable dans des bornes sûres ; une réduction de politique raccourcit ou révoque les sessions concernées.

Une nouvelle vérification intervient pour un nouvel appareil, un risque détecté ou une action sensible. Les appareils peuvent être révoqués individuellement ou globalement.

Un utilisateur PhotoVault connecté et déjà vérifié obtient une assertion serveur signée de courte durée. Elle contient intégration, identité, expiration, audience et nonce anti-rejeu ; aucun secret n’est exposé au navigateur.

La session de l’iframe utilise un cookie partitionné lorsqu’il est disponible. Si le navigateur bloque ce mécanisme, le parcours bascule vers le portail en contexte principal ou vers un lien temporaire envoyé au contact vérifié. Le numéro public d’un ticket n’est jamais une preuve d’accès.

## 8. Canaux et application publique

L’application publique expose trois modes : portail complet, `widget.js` avec iframe isolée, et contrats documentés pour intégrations futures. `postMessage` n’accepte que les origines exactes configurées.

Le navigateur communique en même origine avec le BFF de l’application publique, qui relaie vers les modules publics NestJS. Le chargeur du widget ne reçoit aucun privilège. Les adaptateurs serveur à serveur utilisent des assertions ou signatures dédiées et ne partagent jamais les secrets avec le navigateur.

Chaque adaptateur traduit les entrées en commandes communes et les événements sortants en messages propres au canal. Le WebSocket public possède une authentification et un espace distincts du `/ws` interne ; l’email reste le canal durable par défaut.

WhatsApp sera un adaptateur webhook entrant et sortant avec validation de signature, idempotence, consentement, fenêtre de service et modèles approuvés. Le noyau ticket restera inchangé.

## 9. Parcours conversationnel et bot

Le parcours suit `START → RECOGNIZE_OR_VERIFY → QUALIFY → DRAFT → CONFIRM → CREATED → FOLLOW_UP_OR_HANDOFF`.

Le formulaire « Créer sans assistant » reste toujours accessible. La conversation est persistée côté serveur et le ticket n’est créé qu’après confirmation explicite, sauf transfert humain : les informations vérifiées peuvent alors ouvrir un ticket de triage.

Le bot accède uniquement à une liste fermée d’outils : documentation publique, catégories autorisées, préparation du brouillon, création confirmée, consultation publique, ajout de message et transfert humain. Il ne consulte ni note interne, ni audit, ni endpoint arbitraire.

Le modèle peut suggérer une catégorie, mais les règles serveur décident du routage, de la priorité, de la sévérité et du SLA. Une faible confiance, des échecs répétés, une demande explicite ou un sujet sensible déclenche le transfert humain.

Le fournisseur d’IA est abstrait. Prompts, modèle et documentation sont versionnés par intégration. Une recherche éditorialisée simple précède toute éventuelle base vectorielle. En panne, le formulaire continue de fonctionner.

## 10. Admission, routage et SLA

Le public fournit problème, service concerné, impact, réponses guidées et pièces jointes. Il ne choisit pas département, équipe, priorité technique ou politique SLA.

Le serveur applique des règles ordonnées : configuration de l’intégration, catégorie, produit ou service, matrice impact × urgence, puis file de triage par défaut. Un cas d’usage public distinct appelle ensuite les services existants d’affectation, d’historique et de SLA.

Le SLA commence à la création confirmée. Le temps de conversation préalable est suivi séparément comme délai d’admission.

Les statuts publics sont `RECEIVED`, `IN_PROGRESS`, `WAITING_FOR_CUSTOMER`, `RESOLVED` et `CLOSED`. Ils traduisent les statuts internes sans exposer les détails d’organisation.

## 11. Événements et notifications

Création, réponse publique, demande d’information, changement de statut, résolution, clôture et réouverture produisent un historique et, selon la politique, une livraison externe. Une note interne ne déclenche jamais de livraison externe.

Les événements publics sont écrits transactionnellement avec la mutation métier. Un worker les publie vers BullMQ avec clé d’idempotence, reprises bornées, file d’échecs et état observable. Cette boîte d’envoi évite la perte entre PostgreSQL et la file.

## 12. Interfaces

Le portail propose demandes, chronologie, réponses, pièces jointes, profil, appareils et préférences. Le widget couvre le parcours court et ouvre le portail pour les opérations longues.

Le frontend interne conserve ses pages et affiche demandeur externe, contact vérifié, intégration, canal, résumé du bot, transfert humain et état de livraison. « Répondre au demandeur » et « Note interne » sont visuellement et techniquement séparés.

L’administration centrale gère intégrations, origines, apparence bornée, langues, confiance, quotas, routage, bot, documentation, canaux, modèles, secrets et livraisons échouées.

## 13. Connecteur WordPress

Un quatrième plugin autonome, `trouble-ticket-connector`, injecte le widget, génère les assertions signées et offre insertion automatique ou shortcode. Il configure URL du support, identifiant public, secret protégé, pages, position et libellés, avec test de connexion et rotation du secret.

Le plugin ne stocke ni ticket, ni conversation, ni pièce jointe. Il ne modifie ni WordPress Core, ni les trois plugins existants, ni leurs contrats. Les fonctions d’identité existantes sont consommées par interface stable sans déplacer leur responsabilité.

## 14. Sécurité et données personnelles

- DTO et gardes publics séparés des gardes JWT internes ;
- CORS, CSRF, cookies sécurisés, origines et audiences strictement contrôlés ;
- quotas par IP, intégration, appareil et contact, puis CAPTCHA adaptatif ;
- réponses anti-énumération et limitation renforcée des vérifications ;
- pièces jointes en quarantaine, type réel contrôlé, limites et analyse antivirus ;
- journaux sans jeton, OTP, secret ou contenu personnel complet ;
- conservation configurable et anonymisation lorsque le ticket doit subsister ;
- fusion inter-intégrations uniquement avec consentement ou permission explicite.

## 15. Observabilité et résilience

Les corrélations relient intégration, session, conversation, ticket, événement et livraison. Les métriques couvrent création, vérification, abandon, transfert, première réponse, SLA, files, livraisons, anti-abus, disponibilité et coût du bot.

Chaque intégration possède des interrupteurs pour le bot, les fichiers et les canaux. Une panne d’IA, WordPress ou WhatsApp n’arrête ni le formulaire public ni le ticketing interne.

## 16. Migration et validation

La stratégie est `expand → migrate → contract` : schéma additif, reprise des acteurs actuels en `INTERNAL`, double lecture/écriture, activation par intégration, puis contraintes finales après validation du frontend interne.

Ordre de livraison : fondations ; portail public et email ; widget et PhotoVault ; bot ; nouveaux canaux.

Les validations couvrent migrations, contrats internes, isolation et IDOR, rejeu WordPress, CSRF, origines, limites, fuite de notes, idempotence, pannes de dépendances, navigateurs, fallback pleine page et non-régression des plugins PhotoVault.

Le retour arrière désactive les fonctions par intégration et conserve le schéma additif ; aucune suppression destructive de données n’est utilisée comme mécanisme de rollback.
