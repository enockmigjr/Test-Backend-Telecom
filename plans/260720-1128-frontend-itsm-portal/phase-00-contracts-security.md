# Gate 0 et Gate 1 — Contrats, sécurité et décisions

## Contexte vérifié

- Le backend tourne et expose 79 opérations OpenAPI sur `/api/docs-json`.
- La spec OpenAPI 3.0 décrit les opérations et entrées, mais pratiquement aucun modèle de réponse exploitable.
- Les réponses succès ne sont pas uniformes : enveloppe simple, pagination imbriquée et rapports déjà enveloppés coexistent.
- Le refresh renvoie actuellement le même refresh token au lieu d'effectuer la rotation annoncée.
- Le gateway accepte des rooms arbitraires via `join_room` et utilise un CORS `*` avec credentials.
- Les contrôles de visibilité sont insuffisants sur la liste des tickets, le détail d'audit, les commentaires, notes et pièces jointes.
- L'idempotence est décorée mais son middleware n'est pas enregistré globalement.

## Gate 0 — Décisions d'architecture

### Décisions acceptées

1. **Topologie** : une seule origine publique derrière Nginx.
2. **Dépôt** : `frontend/` est un dépôt Git indépendant, ignoré par le backend parent.
3. **Gestionnaire** : pnpm dans chaque dépôt; CI, lockfile, Docker et Nginx applicatif séparés.
4. **Session** : BFF Next minimal; cookies préfixés `__Host-`, HttpOnly, Secure, SameSite strict ou lax selon les flux validés.
5. **CSRF** : vérification `Origin`/`Host` et jeton CSRF pour les mutations BFF.
6. **HTTP** : le BFF ajoute le Bearer côté serveur; aucun token lisible par JavaScript.
7. **WebSocket** : le backend lit le cookie access sécurisé, valide l'origine et calcule les rooms autorisées.
8. **Rendu** : Server Components appellent la source serveur directement; TanStack Query sert les écrans interactifs. Pas de double fetch systématique.

### Livrables

- [ADR-001 BFF, session, multi-onglets et topologie](./adr-001-bff-session-topology.md).
- Diagramme login → refresh → logout → logout-all → reconnexion WS.
- Décision ADR sur cookies/BFF/CSRF/WS et concurrence multi-onglets.
- Décision ADR sur topologie dépôt, CI, Nginx et Docker.
- Matrice effective rôle + département + ownership + statut.
- Inventaire requêtes/réponses réel, y compris multipart et binaire.

### Critère de sortie

Aucun point non décidé ne doit pouvoir remettre en cause le transport, le stockage de session ou la topologie de déploiement.

## Gate 1 — Correctifs backend P0

### Sécurité

- Appliquer le scope utilisateur/département à `GET /tickets`.
- Appliquer le scope au détail d'audit pour les superviseurs.
- Vérifier la visibilité du ticket pour lecture/écriture de commentaires et notes.
- Vérifier rattachement, visibilité, propriétaire et permission sur les pièces jointes.
- Supprimer les abonnements arbitraires aux rooms ou les autoriser via une whitelist calculée côté serveur.
- Remplacer le CORS WebSocket `*` et supprimer tout secret JWT de repli en production.
- Ajouter limites de taille, MIME autorisés et règle d'association unique aux uploads.

### Authentification

- Implémenter une vraie rotation atomique du refresh token.
- Définir détection de reuse, révocation de famille et comportement concurrent multi-onglets.
- Exposer durée/expiration utile et `mustChangePassword` dans le contrat de session.
- Tester compte désactivé, révocation, expiration, logout-all et refresh simultané.

### Contrats

- Créer DTOs de réponse pour auth, users, tickets, historique, dashboard, audit, rapports et settings.
- Standardiser succès, pagination et erreurs; supprimer les doubles niveaux `data`.
- Corriger `error.message` pour produire un contrat stable de validation.
- Documenter `Idempotency-Key`, multipart, fichiers binaires et erreurs par opération.
- Corriger `category`/`categoryId`, projection assignee, recherche client et tri annoncé.
- Ajouter un endpoint de listing des pièces jointes, ou les inclure dans un détail ticket correctement typé.
- Exposer les données minimales nécessaires à l'assignation et au suivi d'un rapport demandé.
- Exporter un snapshot OpenAPI déterministe et vérifier son diff en CI.

### Idempotence

- Enregistrer réellement le middleware.
- Rendre la coordination atomique et définir le comportement « requête déjà en cours ».
- Utiliser une clé stable par intention utilisateur, renouvelée seulement pour une nouvelle intention.

### Tests obligatoires

- Tests E2E négatifs inter-départements pour tickets, audit, commentaires, notes et fichiers.
- Tests d'accès croisés entre les sept rôles sur les actions sensibles.
- Tests auth multi-onglets et reuse de refresh token.
- Contract test OpenAPI et test des enveloppes réelles.
- Tests idempotence : répétition après succès, concurrence et échec.

### Critère de sortie

La gate échoue si une fuite d'isolation, une room arbitraire, une rotation factice ou un contrat de réponse non typable subsiste.
