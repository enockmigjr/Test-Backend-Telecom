# Phase 6 et Gate 7 — Optimisation, production et roadmap

## Phase 6 — Optimisation mesurée

### Workspace avancé

À introduire seulement après observation des utilisateurs et définition de la persistance :

- onglets internes de tickets et clients;
- split view et panneaux redimensionnables;
- densité compact/confortable;
- command palette et raccourcis;
- tickets récents, épingles et recherches sauvegardées;
- brouillons, reprise de session et layouts persistés.

Les données non sensibles peuvent utiliser un stockage local versionné avec TTL. Les préférences partagées par utilisateur/rôle/département nécessitent des endpoints backend. Zustand n'est ajouté qu'à ce stade.

### Optimisations conditionnelles

- Virtualisation après mesure sur volumes réels.
- Prefetch du ticket suivant lorsque le comportement utilisateur le justifie.
- Web Workers uniquement pour un calcul client réellement coûteux.
- Cursor pagination pour timelines seulement après évolution backend.
- Cache local chiffré uniquement avec modèle de menace et besoin offline explicites.

## Gate 7 — Production

### Sécurité

- TLS, cookies, CSRF, CORS, CSP avec nonce, headers et cache privé validés.
- Téléchargements sensibles autorisés et non cachés publiquement.
- Aucune PII dans logs, analytics, traces ou session replay.
- Tests de session multi-onglets, multi-instance, révocation et reconnexion WS.
- Revue de dépendances avec politique de sévérité et exceptions documentées.
- Revue sécurité dédiée avant mise en production.

### Accessibilité

- Axe automatisé dans les tests critiques.
- Audit clavier complet des flux agent, superviseur et admin.
- Vérification manuelle avec lecteur d'écran sur les flux critiques.
- Zoom 200 %, focus visible, cibles et reduced motion vérifiés.
- WCAG 2.2 AA reste un objectif jusqu'à audit manuel documenté.

### Performance

- Budgets lab : bundle, LCP, INP simulé et CLS via Lighthouse/Playwright.
- Objectifs RUM après production : LCP ≤ 2,5 s, INP ≤ 200 ms, CLS ≤ 0,1 au p75.
- Alertes sur erreurs frontend, requêtes lentes et échec de chargement de chunk.
- Aucun graphique lourd ni code admin dans le chemin initial agent.

### Exploitation

- Images Docker reproductibles, health checks et configuration par environnement.
- Nginx route Next, API et WebSocket sous la topologie validée.
- Déploiement progressif, rollback, smoke tests et runbook incident.
- Observabilité frontend reliée au correlation ID sans fuite de données.

### Critère de sortie

La gate échoue si une gate de sécurité, un flux critique E2E, un audit accessibilité manuel, le rollback ou les smoke tests ne sont pas validés.

## Roadmap dépendante du backend

### Client 360° télécom

Nécessite modèles et contrats pour clients, comptes, produits, services, couverture, QoS, interactions, contrats, segments et churn. Le triplet client du ticket ne suffit pas.

### Ticketing avancé

Nécessite types de tickets, schémas de formulaires, champs conditionnels, détection de doublons, checklists, cause racine, impact, urgence, tags contrôlés, problèmes connus, macros, réponses planifiées, bulk actions et undo compensable.

### SLA/OLA et workforce

Nécessite OLA, calendriers et jours fériés, fuseaux, contrats, historique de pauses, explication du calcul, first-response breach séparé, prévision, escalade automatique, congés structurés et files de secours.

### Opérations télécom

Nécessite catalogue d'opérations, double approbation, re-authentification, idempotence métier, suivi demandé/en file/exécuté/échoué/compensé et rapport d'impact d'incident majeur.

### IA contrôlée

Nécessite contrats d'entrée/sortie, provenance, score de confiance, consentement, audit des suggestions, évaluation, garde-fous PII et possibilité de refus. Aucun faux bouton IA avant ce socle.

## Principe de roadmap

Chaque lot commence par son modèle de données, API, RBAC, audit et tests de sécurité. Aucune fonctionnalité n'est simulée avec des mocks dans la build de production.
