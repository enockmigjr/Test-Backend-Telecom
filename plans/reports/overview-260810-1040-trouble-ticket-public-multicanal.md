# Vue d'ensemble — Trouble ticket public et multicanal (état au 10/08/2026)

## 1. Ce qui existe déjà (vérifié dans le dépôt)

### Backend NestJS (`src/modules/public-support`, `external-identity`, `external-delivery`, `outbox`)

- **Identité publique sans compte** : code email OTP (6 chiffres, Mailpit en dev), assertion signée WordPress (membre connecté), appareils de confiance 90 jours renouvelables, session publique JWT HttpOnly portée par le BFF, révocation d'appareil.
- **Admission** : catalogue par intégration (`routingPolicy.allowedCategoryIds`), catégories gérées côté backend, services, impact/urgence, auto-routage vers département/équipe.
- **Conversations** : `create → draft → confirm` atomique, reprise de brouillon, demande de transfert humain, idempotence.
- **Tickets publics** : liste par demandeur + intégration, détail, timeline filtrée, commentaire demandeur, préférences (nom, langue).
- **Outbox + livraison externe** : événements de domaine dans `outbox_events`, worker BullMQ `external-delivery`, table `external_deliveries` (statuts PENDING/PROCESSING/DELIVERED/FAILED), contrat `ChannelAdapter` déjà injecté pour email.
- **Temps réel public** : namespace WebSocket dédié, cookies de session publics, repli polling côté frontend.
- **Configuration d'intégration** : `support_integrations` (origines, apparence, routing, quota, confiance, fonctionnalités), chiffrement des secrets d'intégration, config exposée sans secret.
- **Pièces jointes** : désactivées tant que ClamAV n'est pas opérationnel (gate absolue respectée) ; pipeline d'analyse présent.

### Portail et widget (`public-frontend/`, dépôt Git autonome)

- BFF même origine, cookies publics HttpOnly + CSRF, aucun token accessible au chargeur.
- Portail pleine page : vérification du contact, Mes demandes (liste + détail + timeline + commentaires), nouvelle demande (formulaire aligné sur le widget), profil, appareils.
- Widget iframe v1/v2 avec chargeur statique sans framework, handshake d'origine signé, fallback pleine page, temps réel.
- Palette claire alignée sur le frontend interne (fond `slate-50`, accent bleu), responsive.

### Connecteur WordPress (`trouble-ticket-connector`, plugin autonome)

- Assertion d'identité signée (membre WP connecté), injection auto/shortcode, page d'administration, stockage de secret chiffré, désinstallation propre.
- Aucun ticket, message ou fichier stocké dans WordPress ; aucun changement WordPress Core ni des trois plugins métier.
- Miroir de distribution PhotoVault synchronisé ; recette navigateur validée (Chromium/Firefox/WebKit) : visiteur anonyme + membre vérifié sans nouvel OTP.

### Compatibilité interne

- La console agents (frontend interne, dépôt séparé) fonctionne sans régression : compatibilité acteurs déployée (phase 01b), les acteurs sont des unions discriminées, le namespace WS public n'est pas consommé par l'interne.

## 2. Ce qui manque (phases planifiées et restantes)

| Phase | Objet | État |
|---|---|---|
| 00–05 | Contrats, données, sécurité, admission, portail, widget | ✅ implémenté et commité |
| 06 | Connecteur WordPress + miroir + runtime | ✅ implémenté et recette validée ; reste la publication du dépôt distant (décision utilisateur) |
| 07 | Administration interne enrichie | ✅ implémentée et commitée (11-12/08) : pages intégrations/demandeurs/livraisons, « répondre au demandeur » vs « note interne », appareils, fusion de profils, rotation de secrets |
| 08 | Bot et connaissance publique | ✅ implémentée et commitée (11-12/08) : base documentaire, abstraction IA (DeepSeek/OpenAI-compatible), outils fermés, parcours brouillon/confirmation/handoff ; bot inactif sans clé API |
| 09 | Durcissement, rollout, migration finale | ◐ en cours (12/08) : contraintes acteur validées, tests de pannes, manifest par SHA, rétention/anonymisation commitées ; reste la validation de la rétention sur données réelles |

## 3. Nouveaux défis (avec l'évolution demandée)

1. **Multi-sites et multi-intégrations** : chaque site/client devient une intégration distincte (clé, origines, routage, quota, apparence). Le modèle existe en base, mais tout doit être administrable sans secret exposé — c'est le cœur de la phase 07.
2. **WhatsApp demain** : le contrat `ChannelAdapter` existe pour l'email sortant. WhatsApp demande un adaptateur entrant (messages → conversation publique) + sortant (notifications avec modèles approuvés Meta) + consentement explicite + routage par `destinationKey`. Ne jamais câbler le métier au canal.
3. **Bot « puissant » sans danger** : le bot améliore l'admission, ne crée jamais de ticket sans confirmation ou transfert humain (gate absolue), n'accède ni aux notes internes ni aux audits, coût/tours/appels outils bornés, formulaire disponible pendant toute panne IA.
4. **Notifications fiables** : aucune notification externe ne dépend uniquement d'EventEmitter ou Redis (gate) ; l'outbox + `external_deliveries` + worker existent et doivent rester le seul chemin.
5. **Identité hybride** : membre WP connecté (assertion) et visiteur anonyme (email) coexistent ; il faut prévoir la fusion de profils demandeur et l'expiration des appareils de confiance.
6. **Données personnelles** : demandeurs = adresses email + appareils ; il faut une politique de rétention/anonymisation et un parcours « oublier ce contact » documentés avant production multi-sites.
7. **Ops** : clés d'intégration par environnement (le bug récent de clé factice l'a montré), compose cohérent sans conteneurs hors groupe, migration progressive par flags.

## 4. Choses à prévoir (déjà anticipées dans le plan)

- Contrat de canal formel entrant/sortant (direction, templates, statuts de livraison) avant tout canal autre qu'email.
- Webhook/statut de livraison visible dans le ticket interne (email envoyé/échoué, canal utilisé).
- Métriques d'admission par intégration : quota consommé, conversion brouillon → ticket, délais SLA publics, taux d'OTP consommés.
- Base documentaire publique cloisonnée par intégration et explicitement publique (phase 08) ; recherche textuelle simple d'abord, pas de base vectorielle prématurée.
- Politique de rétention/anonymisation et procédure de réponse incident (phase 09).
- Manifest de release par SHA des quatre dépôts avant production.

## 5. Ce que j'ajouterais que vous ne voyez pas encore

- **Page admin intégrations (phase 07)** avec origines, routage, quotas, apparence, santé et rotation de clés — aucun secret lisible.
- **Deux intentions distinctes dans le ticket interne** : « répondre au demandeur » (public, visible dans la timeline publique) et « note interne » (jamais exposée). Le backend les distingue déjà ; l'UI interne doit les séparer.
- **Statut de livraison dans le ticket** : badge « notification envoyée/échouée » pour chaque événement sortant.
- **Fusion de profils demandeur** avec aperçu des impacts (tickets, conversations, appareils) et audit obligatoire avant exécution.
- **Préférences de canal demandeur** (email uniquement au départ, canal par défaut) et confirmation « suivre par email » lors de la création.
- **Widget thémé par intégration** : l'apparence est déjà dans `support_integrations` ; le brancher dans le widget (couleur, logo, nom) sans jamais accepter de CSS/JS arbitraire.
- **Bot orienté connaissance** : suggestions de résolution issues uniquement d'articles publics éditorialisés, jamais de données internes ; chaque réponse bot traçable et désactivable par intégration.

## 6. Changements structurels pour la maintenabilité

- Garder la frontière **métier ≠ canal** : `public-support` (cas d'usage), `external-identity` (identité), `external-delivery` (adaptateurs + statuts), `outbox` (fiabilité). WhatsApp s'ajoutera comme adaptateur, pas comme couche de ticket.
- `support-knowledge` et `bot` seront des modules séparés (phase 08) avec leur propre politique d'outils (`ToolPolicyService`), sans accès aux services internes non publics.
- Le widget reste un **chargeur statique** : toute l'application vit dans l'iframe du domaine support ; le connecteur WP ne doit jamais grossir avec de la logique métier dupliquée.
- Les contrôleurs restent fins ; toute nouvelle capacité passe par service + cas d'usage + tests ciblés, comme aujourd'hui.
- Secrets : `integration_credentials` chiffrés, rotation sans lecture, jamais dans Git ni les logs.

## 7. Roadmap recommandée

1. **Phase 07** (prochain chantier) : admin intégrations/livraisons + « répondre au demandeur » distinct de la note interne dans la console agents.
2. **Phase 08** : base documentaire + abstraction IA + parcours bot avec confirmation obligatoire.
3. **Phase 09** : durcissement, rétention/anonymisation, tests de pannes, rollout PhotoVault progressif, manifest par SHA.
4. **WhatsApp** : uniquement après contrat d'adaptateur entrant/sortant, compte Meta, modèles approuvés et consentement — jamais avant la phase 09.

La priorité immédiate reste la phase 07 : elle rend l'ensemble administrable et prépare proprement le bot et les canaux.
