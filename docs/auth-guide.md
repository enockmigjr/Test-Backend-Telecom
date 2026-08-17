# Guide complet de l'authentification (SSO Keycloak)

> Ce guide explique **tout** ce qui touche à l'authentification dans le projet
> (backend NestJS + frontend interne Next.js), du clic sur « Se connecter »
> jusqu'aux règles d'accès sur une route API. Il est écrit pour être lu par un
> développeur débutant : chaque notion est expliquée simplement avant d'entrer
> dans le détail technique.

---

## 1. L'idée générale : « qui êtes-vous ? » et « que pouvez-vous faire ? »

Une application sécurisée répond à deux questions pour chaque requête :

1. **Qui êtes-vous ?** (authentification) → « je suis le compte `admin@telecom.local` »
2. **Que pouvez-vous faire ?** (autorisation) → « vous êtes ADMINISTRATOR, vous
   pouvez créer des utilisateurs, consulter l'audit, etc. »

Dans ce projet, la réponse à la première question est donnée **uniquement** par
**Keycloak** : un serveur d'identité qui connaît les comptes et les mots de passe.
Le backend et le frontend **ne stockent plus aucun mot de passe local** et
n'offrent plus de formulaire de connexion interne.

Keycloak nous donne ensuite des **jetons** (des « badges numériques » signés
cryptographiquement) que l'application vérifie à chaque appel.

---

## 2. Les pièces du puzzle

| Élément                        | Rôle                                                                       | Où ça vit                                                                       |
| ------------------------------ | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| **Keycloak**                   | Source de vérité des comptes, mots de passe, rôles, sessions               | Conteneur Docker, port **8081** (realm `telecom`)                               |
| **BFF (frontend interne)**     | `frontend/` (Next.js) — c'est lui qui parle à Keycloak et pose les cookies | Port **3007**                                                                   |
| **Backend API**                | NestJS — vérifie les jetons et applique les droits (RBAC/ABAC)             | Port **3000**                                                                   |
| **Table `users` (PostgreSQL)** | Profil **métier** : rôle, département, disponibilité, absence              | Base `telecom_tickets`                                                          |
| **JWKS**                       | Les clés publiques de Keycloak pour vérifier la signature des jetons       | URL interne `http://keycloak:8080/realms/telecom/protocol/openid-connect/certs` |

**Le principe clé :** Keycloak sait **qui** vous êtes ; la base `users` sait quel
rôle/département **métier** vous avez. Les deux sont reliés par
`users.keycloakSubjectId` (l'identifiant Keycloak de l'utilisateur).

---

## 3. Le flux de connexion, pas à pas

### 3.1. Clic sur « Se connecter » (redirection vers Keycloak)

1. L'utilisateur ouvre `http://localhost:3007`.
2. Sans session valide, Next.js redirige vers `/login`
   ([page.tsx](<../../frontend/src/app/(auth)/login/page.tsx>)) qui redirige à son
   tour vers `/api/auth/keycloak/login`.
3. Cette route BFF construit l'URL d'autorisation Keycloak
   (`buildAuthorizeUrl`) avec :
   - `response_type=code` : on demande un **code** (pas encore de jetons) ;
   - `client_id=telecom-frontend` : le client qui représente l'application ;
   - `redirect_uri=http://localhost:3007/api/auth/keycloak/callback` : où
     Keycloak doit renvoyer le navigateur après connexion ;
   - **PKCE** : un `code_challenge` (empreinte d'un secret aléatoire). Si un
     attaquant volait le code, il ne pourrait pas l'échanger sans le secret.

### 3.2. Saisie des identifiants chez Keycloak

Le navigateur arrive sur la page de login **Keycloak** (thème personnalisé aux
couleurs de l'app, « Keycloakify »). L'utilisateur saisit son email et son mot de
passe **Keycloak**. Keycloak vérifie les identifiants et le compte (actif ?
désactivé ? mot de passe à changer ?) puis redirige le navigateur vers le
`callback` avec un **code** à usage unique.

### 3.3. Échange du code (côté serveur BFF)

La route `/api/auth/keycloak/callback` :

1. Récupère le `code` ;
2. L'échange contre des jetons auprès de Keycloak
   (`exchangeCode` → `grant_type=authorization_code` + `code_verifier` PKCE) ;
3. Reçoit trois jetons :
   - **access_token** (15 min) : prouve l'identité, envoyé à l'API ;
   - **refresh_token** (7 j) : permet de renouveler l'access token sans
     redemander le mot de passe ;
   - **id_token** (5 min) : sert à la **déconnexion** (id_token_hint).
4. Pose des **cookies HttpOnly** (invisibles pour le JavaScript) :
   `access_token`, `itsm-refresh-token`, `kc_id_token`, + cookie CSRF ;
5. Redirige vers la page d'accueil (`/dashboard` ou `/tickets` selon le rôle).

### 3.4. Les cookies de session

| Cookie               | Contenu                | Durée          | But                                       |
| -------------------- | ---------------------- | -------------- | ----------------------------------------- |
| `access_token`       | Jeton d'accès Keycloak | 15 min         | Envoyé en `Authorization: Bearer` à l'API |
| `itsm-refresh-token` | Refresh token Keycloak | 7 j            | Renouveler l'access token                 |
| `kc_id_token`        | ID token               | 7 j (conservé) | Déconnexion OIDC (`id_token_hint`)        |
| `itsm-csrf-token`    | Jeton anti-CSRF        | session        | Protéger les mutations BFF                |

En production ces cookies doivent être `__Host-*`, `Secure`, `HttpOnly`,
`SameSite=Lax`, `Path=/` (voir `frontend/src/lib/auth/env.ts`).

---

## 4. Le renouvellement automatique (refresh)

L'access token expire après 15 minutes. Plutôt que de déconnecter l'utilisateur,
le BFF le renouvelle :

1. Sur une requête API, si l'access token est absent/expiré, le proxy BFF
   (`frontend/src/lib/api/server-proxy.ts`) appelle `refreshKeycloakTokens`
   (grant `refresh_token` vers Keycloak).
2. Keycloak vérifie le refresh token et renvoie un nouveau couple
   (access + refresh).
3. Le BFF met à jour les cookies et rejoue la requête.

**Point important (issuer stable) :** Keycloak est configuré avec
`KC_HOSTNAME=localhost` + `KC_HOSTNAME_PORT=8081`. Cela fixe l'« issuer » des
jetons à `http://localhost:8081/realms/telecom`, que la requête arrive par
l'URL publique (`localhost:8081`) ou par le nom Docker interne
(`keycloak:8080`). Sans cela, Keycloak déduisait l'issuer de l'hôte de chaque
requête et **rejetait les refresh tokens** (« Invalid token issuer ») → 502.

Si le refresh token est refusé (400/401), le BFF **purge les cookies** et
redirige proprement vers `/login` (plus jamais de 502 bloquant).

---

## 5. Comment l'API valide un jeton

À chaque requête protégée, NestJS exécute la **stratégie JWT**
(`src/modules/auth/strategies/jwt.strategy.ts`) :

1. **Lecture du jeton** : header `Authorization: Bearer <token>`.
2. **Signature** : pour les jetons Keycloak (algorithme RS256), la clé publique
   est récupérée via **JWKS** (`KeycloakJwksService`) — jamais de secret partagé.
3. **Issuer** : `iss` du jeton doit être exactement `KEYCLOAK_ISSUER`
   (`http://localhost:8081/realms/telecom`).
4. **Liaison au profil métier** :
   - `findProfileBySubject(sub)` cherche `users.keycloakSubjectId = sub` ;
   - sinon, au premier login, `bindProfileByEmail` relie le profil par email
     vérifié et mémorise le `keycloakSubjectId`.
5. **Contrôles** : le compte doit exister, être actif (`isActive=true`) et non
   supprimé (`deletedAt IS NULL`).
6. **Rôle** : priorité au rôle Keycloak (`realm_access.roles`), sinon au rôle
   métier en base.

Le résultat est stocké dans `request.user` (objet `JwtPayload`) :
`{ sub, id, email, role, departmentId, mustChangePassword, jti }`.

### Les guards (portiers)

| Guard                         | Rôle                                                                                                                                                                    |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `RequestAuthGuard` (global)   | Aiguille chaque route vers un mode d'auth : `INTERNAL` (jeton Keycloak), `ANONYMOUS` (publique), `PUBLIC_SESSION` (portail public), `INTEGRATION_ASSERTION` (WordPress) |
| `JwtAuthGuard`                | Vérifie qu'un jeton valide est présent                                                                                                                                  |
| `RolesGuard`                  | Vérifie `@Roles('ADMINISTRATOR', ...)` sur les routes sensibles                                                                                                         |
| `PasswordChangeRequiredGuard` | Refuse l'accès si `mustChangePassword=true` (sauf routes autorisées)                                                                                                    |

La route `GET /api/v1/auth/me` renvoie le profil du jeton courant (utilisée par
le frontend pour savoir qui est connecté).

---

## 6. La déconnexion

### 6.1. « Se déconnecter »

1. Le menu appelle `/api/auth/keycloak/logout` (le BFF efface les cookies).
2. Le BFF redirige vers l'endpoint OIDC **end-session** de Keycloak avec
   `id_token_hint` (l'id_token conservé) et `post_logout_redirect_uri=/login`.
3. Keycloak **termine réellement la session SSO** (tous les clients du realm)
   puis renvoie sur `/login`.

Avant ce correctif, le bouton appelait un ancien logout local qui ne touchait
jamais Keycloak : la session SSO survivait et l'utilisateur était
**reconnecté automatiquement**. Ce n'est plus le cas.

### 6.2. « Déconnecter toutes les sessions »

La route `/api/auth/keycloak/logout-all` :

1. Décode `sub` depuis l'access token (l'utilisateur Keycloak) ;
2. Obtient un **jeton admin** Keycloak (compte bootstrap du realm `master`) ;
3. Appelle l'API admin :
   `POST /admin/realms/telecom/users/{sub}/logout` → **révoque toutes les
   sessions** de l'utilisateur (tous les appareils) ;
4. Termine aussi la session du navigateur courant (end-session) → `/login`.

Si la révocation admin échoue, un repli termine au moins la session courante
(header `x-logout-all-degraded: true`).

---

## 7. La console de compte (« Compte et mot de passe »)

Le menu et les paramètres proposent un lien vers la **console de compte
Keycloak** : `http://localhost:8081/realms/telecom/account/`.

- Elle permet de changer son **mot de passe**, gérer ses **sessions** actives,
  ses **appareils** (TOTP) et ses **applications** ;
- Elle est **thématisée aux couleurs de l'app** (thème Keycloakify Multi-Page,
  même charte que le login) ;
- C'est Keycloak qui la sert : l'application n'a plus aucun formulaire de
  changement de mot de passe.

> Si la console affiche une erreur (401/403), reconnectez-vous d'abord (une
> session Keycloak valide est nécessaire) — les anciennes sessions émises avant
> le correctif d'issuer doivent être purgées.

---

## 8. Création d'un utilisateur par l'admin (mot de passe temporaire)

Quand un administrateur crée un utilisateur
(`POST /api/v1/users`, `UsersService.create`) :

1. **Profil métier** en base : email, nom, rôle, département,
   `mustChangePassword=true` ;
2. **Provisionnement Keycloak** (`KeycloakAdminService`) :
   - `createUser` : crée le compte SSO (actif, email vérifié) ;
   - `resetPassword(tempPassword, temporary: true)` : pose un mot de passe
     **temporaire** → Keycloak ajoute l'action requise **`UPDATE_PASSWORD`** ;
   - `syncRealmRoles(userId, [rôle])` : attribue le rôle realm correspondant
     (ex. `ADMINISTRATOR`) ;
   - `ensureAccountRoles(userId)` : attribue `view-profile` + `manage-account`
     sur le client `account` — **indispensable** pour que l'utilisateur puisse
     ouvrir la console de compte (sinon Keycloak répond 403) ;
   - mise à jour de `users.keycloakSubjectId` ;
3. **Email de bienvenue** (BullMQ) avec le mot de passe temporaire ;
4. À la **première connexion**, Keycloak **force le changement de mot de passe**
   avant de laisser entrer (comportement natif vérifié : tant que l'action
   `UPDATE_PASSWORD` est présente, la connexion interactive redirige vers
   l'écran de changement).

Si le provisionnement Keycloak échoue (service indisponible, configuration
manquante), la création est annulée (profil supprimé logiquement) et une erreur
claire est renvoyée — jamais de « demi-compte ».

> **Note** : le changement du mot de passe temporaire est imposé **par Keycloak**
> (`UPDATE_PASSWORD`) ; l'application n'a plus de garde-fou `mustChangePassword`
> (l'ancien `PasswordChangeRequiredGuard` a été supprimé — il bloquait l'accès
> même après le changement fait chez Keycloak).

### Activation / désactivation

- `deactivate` → `isActive=false` **en base** **et** `enabled=false` **chez
  Keycloak** : la connexion SSO est refusée ;
- `activate` → l'inverse ;
- changement de rôle (`update`) → `syncRealmRoles` met à jour le rôle realm.

---

## 9. Le WebSocket

La connexion WebSocket interne (`/ws`) s'authentifie via le **cookie access**
(`WebSocketAuthService`) ou un jeton Bearer — même validation que l'API (RS256
Keycloak + profil métier).

---

## 10. Variables d'environnement (auth)

| Variable                                     | Valeur dev                                                          | Rôle                                                        |
| -------------------------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------- |
| `KEYCLOAK_ISSUER`                            | `http://localhost:8081/realms/telecom`                              | URL publique (navigateur + comparaison `iss`)               |
| `KEYCLOAK_INTERNAL_ISSUER`                   | `http://keycloak:8080/realms/telecom`                               | URL interne (échanges BFF/backend → Keycloak)               |
| `KEYCLOAK_JWKS_URL`                          | `http://keycloak:8080/realms/telecom/protocol/openid-connect/certs` | Clés publiques de vérification                              |
| `KEYCLOAK_CLIENT_ID`                         | `telecom-frontend`                                                  | Client OIDC de l'application                                |
| `KEYCLOAK_REDIRECT_URI`                      | `http://localhost:3007/api/auth/keycloak/callback`                  | Callback autorisé                                           |
| `KEYCLOAK_ADMIN` / `KEYCLOAK_ADMIN_PASSWORD` | `admin` / dev                                                       | Compte admin (realm `master`) pour provisionner et révoquer |
| `KEYCLOAK_HOSTNAME` / `KC_HOSTNAME_PORT`     | `localhost` / `8081`                                                | Issuer stable (anti « Invalid token issuer »)               |
| `AUTH_CSRF_SECRET`                           | ≥ 32 caractères                                                     | Signature des jetons CSRF BFF                               |

---

## 11. Dépannage rapide

| Symptôme                                       | Cause probable                                  | Correctif                                              |
| ---------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------ |
| `401` sur l'API                                | Jeton expiré / invalide                         | Se reconnecter (le BFF renouvelle normalement)         |
| `502` + « Session momentanément indisponible » | Ancienne session avec issuer incohérent         | Reconnecter une fois ; vérifier `KC_HOSTNAME`          |
| « Nom d'utilisateur ou mot de passe invalide » | Le compte n'existe **pas dans Keycloak**        | Créer l'utilisateur via l'admin (provisionne Keycloak) |
| `403` / `401` sur la console de compte         | Session Keycloak absente ou ancienne            | Se déconnecter puis se reconnecter                     |
| Log Keycloak « Invalid token issuer »          | `KC_HOSTNAME` non aligné avec `KEYCLOAK_ISSUER` | Fixer `KC_HOSTNAME` (voir section 4)                   |

---

## 12. Où se trouve le code ?

- Frontend : `frontend/src/lib/auth/` (cookies, PKCE, endpoints Keycloak),
  `frontend/src/app/api/auth/keycloak/` (login, callback, logout, logout-all,
  account), `frontend/src/features/auth/use-session-actions.ts` (boutons).
- Backend : `src/modules/auth/` (stratégie JWT, guards, JWKS,
  `services/keycloak-admin.service.ts`), `src/modules/users/users.service.ts`
  (provisionnement), `src/modules/auth/auth.controller.ts` (`GET /auth/me`).
- Thème Keycloak : `keycloak-theme/src/` (login + account), realm importé
  `keycloak/import/telecom-realm.json`.
