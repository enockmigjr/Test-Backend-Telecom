# ADR-001 — BFF, session et topologie frontend

- Statut : accepté
- Date : 2026-07-22
- Portée : portail ITSM Release 1

## Contexte

Le portail manipule des tickets et données internes sensibles. Il doit éviter tout jeton accessible à JavaScript, partager une origine avec l'API et le WebSocket, tout en gardant des cycles de livraison frontend et backend indépendants.

## Décision

### Dépôts et livraison

- `frontend/` est un dépôt Git indépendant, ignoré par le dépôt backend parent.
- Chaque dépôt garde son lockfile pnpm, sa CI, son image Docker et sa configuration Nginx applicative.
- Une configuration d'edge déployée séparément assemble les services sous une origine publique unique.
- Le frontend ne dépend pas d'un workspace, hook Git ou pipeline du backend. Les contrats passent par le snapshot OpenAPI backend publié et contrôlé en CI.

### Origine et routage

- `/` est servi par Next.js.
- `/api/v1` est exposé au navigateur via le BFF Next; celui-ci appelle Nest sur le réseau privé.
- `/ws` est routé par l'edge Nginx vers le gateway Socket.IO Nest avec upgrade HTTP.
- Aucun CORS large n'est nécessaire en production, car les surfaces partagent la même origine publique.

### BFF et cookies

- Le BFF possède la session navigateur et ajoute le Bearer uniquement lors de ses appels serveur vers Nest.
- Les jetons access et refresh sont stockés dans des cookies `__Host-`, `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, sans attribut `Domain`.
- Aucun jeton d'authentification n'est exposé à JavaScript, au stockage navigateur, à une URL ou à un log.
- Le cache partagé est interdit sur les réponses authentifiées et les téléchargements sensibles.

### CSRF

- Toute mutation BFF vérifie que `Origin` correspond au `Host` public attendu. Une requête sans origine est refusée pour le navigateur.
- Un jeton CSRF aléatoire, lié à la session, est rendu au client puis renvoyé dans un header dédié. Le BFF le compare en temps constant avant de relayer la mutation.
- `SameSite` est une défense complémentaire, pas le contrôle CSRF principal.

### WebSocket

- Le navigateur ouvre `/ws` sans jeton dans le payload ou l'URL; le cookie `__Host-` est envoyé lors du handshake même origine.
- Nest authentifie le cookie, contrôle strictement `Origin` et calcule côté serveur les rooms autorisées.
- Après refresh, reconnexion ou révocation, le socket est réauthentifié; une session révoquée ferme ses sockets.

### Concurrence multi-onglets

- Le BFF sérialise un refresh par session. La rotation et la détection de réutilisation restent atomiques côté backend.
- Les onglets échangent seulement des signaux `session-updated` et `logout` via `BroadcastChannel`; aucun jeton ne transite entre eux.
- Chaque onglet peut maintenir son socket. Les événements sont identifiés, dédupliqués, puis une resynchronisation HTTP suit chaque reconnexion.
- Un logout global invalide la session serveur, expire les cookies et ferme les sockets avant diffusion du signal aux onglets.

## Conséquences

- Les déploiements restent indépendants, mais l'edge teste conjointement `/`, `/api/v1` et `/ws` avant promotion.
- Le backend doit ignorer `frontend/`; cette règle est un prérequis de création du dépôt frontend.
- Les changements incompatibles du contrat OpenAPI bloquent la CI et déclenchent une mise à niveau explicite du client.
- Le développement local utilise des proxys équivalents à la production pour éviter un chemin d'authentification divergent.

## Options écartées

- Monorepo Git et CI commune : couplage de livraison contraire à la décision produit.
- Jetons dans le stockage navigateur : exposition accrue en cas de XSS.
- Appel direct de Nest par le frontend pour HTTP : contourne la propriété de session du BFF.
- Jeton WebSocket dans la query string : risque de fuite dans les logs et outils d'observabilité.

## Vérifications attendues

- Tests login, rotation, refresh simultané, logout et logout-all sur plusieurs onglets.
- Tests CSRF pour origine absente ou invalide et jeton absent ou invalide.
- Tests handshake WS, origine invalide, révocation, reconnexion et room interdite.
- Smoke tests edge sur les trois routes et rollback indépendant de chaque service.

## Questions non résolues

- Aucune pour la topologie et le transport. Les noms exacts des domaines internes relèvent du déploiement.
