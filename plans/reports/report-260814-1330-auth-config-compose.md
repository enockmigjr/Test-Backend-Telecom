# Report — Auth Keycloak, rôles superviseur et configuration compose

## Mise à jour (14/08/2026, 13 h 40)

- [VÉRIFIÉ] Keycloak **26.7.1 déployé** (conteneur recréé, health 200, version confirmée). La montée a été rendue possible par la reprise du réseau (image téléchargée).
- [VÉRIFIÉ] Le correctif amont attendu n'existe PAS : la page `applications.ftl` de la console Account v1 reste cassée en 26.7.1 (issue amont fermée « not planned » — `ApplicationsBean` référence une classe retirée). La mitigation (entrée « Applications » masquée) est **conservée** et vérifiée dans le jar déployé (`applicationsUrl` absent du bundle KcPage account).
- [VÉRIFIÉ] Doublon de thème corrigé : le Dockerfile copie désormais uniquement `keycloak-theme-for-kc-26.2-and-above.jar` (avant : glob `26*.jar` → 2 jars, doublons de thème dans `/opt/keycloak/providers`).
- [VÉRIFIÉ] Page « changement de mot de passe » uniformisée incluse dans le jar (`LoginUpdatePassword-*.js`, champ `password-new` présent).
- [NON EXÉCUTÉ] Vérification navigateur des parcours (console, changement de mot de passe, superviseur) — laissée à l'utilisateur.

## Périmètre

Rapport evidence-led sur trois volets, produit le 14/08/2026 (13 h 00–13 h 10, heure locale) :

1. Console de compte Keycloak : erreur 500 sur `/realms/telecom/account/applications`, mitigation du thème, montée 26.7.1 planifiée.
2. Rôles superviseur : cause racine des 403 (rôle technique pris pour rôle métier), correctif JWT, tests, état API.
3. Backend/config/compose/env : layout d'initialisation réel (pas de `progress/init`), fichiers `src/config`, parité dev/prod des compose, alignement `.env`/`.env.example`.

Méthode : lecture des fichiers avec numéros de ligne, commandes Docker (`docker ps`, `docker compose ps -a`, `docker logs`, `docker inspect`, `docker exec`), requête PostgreSQL en lecture seule sur la base `keycloak`, appel HTTP `GET /api/v1/health`, exécution complète de `pnpm test:unit --runInBand` (89 suites, 583 tests).

Non exécuté : déploiement effectif de Keycloak 26.7.1 (image non téléchargée, réseau), vérification navigateur de la console de compte et du parcours de changement de mot de passe, E2E navigateur des pages superviseur.

## Constats

### 1) Console de compte Keycloak

- [VÉRIFIÉ] La route de la console renvoie une erreur serveur sur Keycloak 26.7.0 : logs du conteneur `telecom-keycloak` (2026-08-13) `NoClassDefFoundError: org/keycloak/services/resources/admin/permissions/AdminPermissions` dans `ApplicationsBean.lambda$new$0`, `Caused by: java.lang.ClassNotFoundException` (`docker logs telecom-keycloak --tail 400`).
- [VÉRIFIÉ] La classe est absente de tous les jars de l'image : scan `docker exec telecom-keycloak sh -c 'for f in /opt/keycloak/lib/lib/main/*.jar; do unzip -l ... AdminPermissions ...'` → `SCAN_DONE` sans aucun `FOUND`.
- [VÉRIFIÉ] L'image en cours d'exécution est bien 26.7.0 : jars `org.keycloak.keycloak-common-26.7.0.jar`, `keycloak-core-26.7.0.jar` etc. dans `/opt/keycloak/lib/lib/main/` ; le conteneur tourne sur l'image locale `testbackendtelecom-keycloak:latest`.
- [VÉRIFIÉ] Le correctif est planifié au niveau du Dockerfile : `keycloak-theme/Dockerfile:22` → `FROM quay.io/keycloak/keycloak:26.7.1`.
- [NON EXÉCUTÉ] Le déploiement 26.7.1 n'a pas abouti : aucune image `quay.io/keycloak/keycloak` présente localement (`docker images quay.io/keycloak/keycloak` vide). Le détail réseau « 8 Mo/37 min, build annulé » est [SUPPOSÉ] (rapporté, non rejoué ici) ; seul l'état « 26.7.1 absente, 26.7.0 en cours » est vérifié.
- [VÉRIFIÉ] Mitigation appliquée : l'entrée « Applications » n'est plus rendue dans la sidebar de la console, avec commentaire explicatif `keycloak-theme/src/account/Template.tsx:99-101` (lien `sessions` ligne 97, entrée `log` ligne 102).
- [VÉRIFIÉ] Page de changement de mot de passe uniformisée : `keycloak-theme/src/pages/LoginUpdatePassword.tsx` (champs `password-new`/`password-confirm`, `aria-invalid`, affichage/`logout-sessions`), câblée dans `keycloak-theme/src/login/KcPage.tsx:8,27-28` (`login-update-password.ftl`), styles `.kc-field-error`, `.kc-check`, `.kc-actions`, `.kc-button-ghost` dans `keycloak-theme/src/styles.css:220-249`.
- [VÉRIFIÉ] Bouton « Retour à la connexion » de la page d'erreur avec repli : `keycloak-theme/src/pages/Error.tsx` → `backHref = kcContext.url.loginAction ?? kcContext.url.loginUrl ?? "/"`.
- [VÉRIFIÉ] Contexte 403 console corrigé au tour précédent : rôles client `account` `view-profile`/`manage-account` présents dans `keycloak/import/telecom-realm.json:50,61`, attribués aussi aux comptes seedés (`keycloak/seed-users.mjs` `assignAccountRoles`) ; issuer stable côté dev via `KC_HOSTNAME: ${KEYCLOAK_HOSTNAME:-localhost}` (`docker-compose.yml:82-85`), côté prod via `--hostname=${KEYCLOAK_HOSTNAME:-auth.example.com}` (`docker-compose.prod.yml`, commande du service keycloak).
- [NON EXÉCUTÉ] Vérification navigateur de la console de compte (login SSO, applications, changement de mot de passe) — laissée à l'utilisateur.

### 2) Rôles superviseur (frontend + backend)

- [VÉRIFIÉ] Cause racine des 403 documentée et corrigée dans `src/modules/auth/strategies/jwt.strategy.ts` : allowlist `BUSINESS_ROLES` (7 rôles métier, lignes 28-36), `validateKeycloak` ne garde que le rôle métier trouvé dans `realm_access.roles` avec repli sur le rôle DB (`businessRole ?? user.role`), commentaire explicite sur `default-roles-telecom`/`offline_access`/`uma_authorization`.
- [VÉRIFIÉ] Test de non-régression ajouté : `jwt.strategy.spec.ts:133-152` « ignore les rôles techniques (default-roles, offline_access) et garde le rôle métier » → `role: 'SUPERVISOR'`.
- [SUPPOSÉ] Le contenu exact des jetons Keycloak réels (`default-roles-telecom`, `offline_access`, `uma_authorization`) n'a pas été décodé pendant ce rapport ; il est documenté dans le code et simulé dans le test.
- [VÉRIFIÉ] Frontend : `frontend/src/components/layout/navigation.ts` expose `navigationForRole` (ligne 117) filtrant par rôle, utilisé dans `app-sidebar.tsx:32` ; les pages dashboard, audit, rapports sont gardées par `AccessGate allow={isSupervisor}` (`frontend/src/app/(portal)/dashboard/page.tsx`, `audit/page.tsx`, `reports/page.tsx`) ; `isAdmin`/`isSupervisor` définis dans `frontend/src/features/users/components/access-gate.tsx` ; actions admin masquées via `isAdministrator` dans `frontend/src/features/users/components/users-page.tsx:22,99`.
- [VÉRIFIÉ] Backend : `@Roles('ADMINISTRATOR','SUPERVISOR')` sur les endpoints dashboard (`src/modules/dashboard/dashboard.controller.ts:47,62,79,106,133,154,189,211,240`), audit (`src/modules/audit-logs/audit-logs.controller.ts:28-29`), rapports (`src/modules/reports/reports.controller.ts:33-34,229`). Précision : `POST /reports/weekly/generate` reste `ADMINISTRATOR` seul (`reports.controller.ts:158`).
- [VÉRIFIÉ] Exécution du 14/08/2026 : `pnpm test:unit --runInBand` → `Test Suites: 89 passed, 89 total ; Tests: 583 passed, 583 total`.
- [VÉRIFIÉ] API redémarrée avec le correctif : `GET http://localhost:3000/api/v1/health` → HTTP 200 `{"success":true,"statusCode":200,"data":{"status":"ok","timestamp":"2026-08-14T13:03:28.001Z","uptime":200}}` (le chemin racine `/health` n'existe pas ; le préfixe global est `api/v1`, `src/config/app.config.ts:33-34`, `src/main.ts:64`).

### 3) Backend, config, compose, env

- [VÉRIFIÉ] Il n'existe aucun dossier `progress/init` pour Keycloak dans ce dépôt (`Test-Path progress/init` → False ; `rg --files` ne trouve que `postgres/init/01-keycloak-db.sql`). Layout réel : `postgres/init/01-keycloak-db.sql` (crée la base `keycloak` au premier démarrage PostgreSQL), `keycloak/import/telecom-realm.json` importé via `--import-realm` (`docker-compose.yml:73`, commande prod), `keycloak/seed-users.mjs`, migrations Drizzle dans `src/database/migrations` (dossiers `meta/`, `0000_baseline-current-schema.sql` et suivants).
- [VÉRIFIÉ] Le seed provisionne par défaut 105 comptes (`7 rôles × SEED_PER_ROLE=15`, `keycloak/seed-users.mjs:9-15,105-111`) ; état réel de la base : 110 utilisateurs dans le realm `telecom`, dont exactement 105 `agent.*` et 5 autres (`admin@telecom.local`, `supervisor@telecom.local`, `test2@gmail.com`, `test3@gmail.com`, `test4@gmail.com`) — `psql` sur `keycloak` (`user_entity`/`realm`).
- [VÉRIFIÉ] `src/config` piloté par env avec défauts de dev : `app.config.ts` (port 3000, préfixe `api/v1`, CORS, throttle), `jwt.config.ts` (fallbacks dev, garde prod : secret ≥ 32 caractères, lignes 71-82), `database.config.ts`, `redis.config.ts`, `public-support.config.ts`.
- [VÉRIFIÉ] Secrets de dev à surcharger : `docker-compose.yml:76` (`KEYCLOAK_ADMIN_PASSWORD:-Admin@1234`), `keycloak/import/telecom-realm.json:51` (mot de passe admin du realm), `keycloak/seed-users.mjs:10,12` (`Admin@1234`, `Telecom@2026!`), fallbacks JWT dans `jwt.config.ts`. Le compose prod exige déjà plusieurs secrets via `:?` (`KEYCLOAK_ADMIN_PASSWORD`, `AUTH_CSRF_SECRET`, `REPORT_DOWNLOAD_SECRET`, `PUBLIC_SUPPORT_*`, etc.).
- [VÉRIFIÉ] Compose dev = `docker-compose.yml` : 16 services (postgres, redis, clamav, keycloak, api, public-frontend, frontend, nginx, mailpit, prometheus, alertmanager, loki, tempo, grafana, promtail, uptime-kuma). Compose prod = `docker-compose.prod.yml` : 8 services (postgres, redis, clamav, keycloak, api, public-frontend, frontend, nginx), sans observabilité ni Mailpit (choix assumé).
- [VÉRIFIÉ] Compose prod : `KC_BOOTSTRAP_ADMIN_USERNAME`/`KC_BOOTSTRAP_ADMIN_PASSWORD` (`docker-compose.prod.yml:55-56`), `KC_PROXY: edge` conservé (ligne 61), `KEYCLOAK_INTERNAL_ISSUER` présent sur le service `frontend` (ligne 145).
- [VÉRIFIÉ] Écart constaté avec le payload reçu : en prod, le service `api` n'a PAS `KEYCLOAK_INTERNAL_ISSUER` (le dev l'a, `docker-compose.yml:136`, et le frontend dev aussi ligne 227). Or le backend le consomme : `src/modules/auth/services/keycloak-admin.service.ts:25` (`KEYCLOAK_INTERNAL_ISSUER ?? KEYCLOAK_ISSUER`). En prod, l'API retombera donc sur l'issuer externe `https://auth.example.com/realms/telecom` pour ses appels admin REST.
- [VÉRIFIÉ] `KC_HTTP_RELATIVE_PATH` n'est présent qu'en dev (`docker-compose.yml:77`) ; le prod passe par `--hostname=${KEYCLOAK_HOSTNAME:-auth.example.com}` dans la commande keycloak. L'affirmation « KC_HOSTNAME*/KC_HTTP_RELATIVE_PATH ajoutés au compose prod » est donc inexacte pour `KC_HTTP_RELATIVE_PATH` ; l'hôte stable est bien couvert par `--hostname`.
- [VÉRIFIÉ] `.env` et `.env.example` : 144 clés uniques identiques des deux côtés (comparaison sur clés uniques, aucun écart). `.env.example` contient 147 lignes de clés car `MAILPIT_WEB_PORT`, `NGINX_HTTP_PORT`, `NGINX_HTTPS_PORT` y sont dupliqués dans les sections dev/prod (lignes 169/174/175 et 217/218/219). `KEYCLOAK_HOSTNAME=localhost` présent dans `.env`.
- [VÉRIFIÉ] Le compose actif est bien le compose dev : `docker compose ps -a` liste les 16 services du projet dev. Nuance : au moment du contrôle, seul `mailpit` tourne parmi l'observabilité ; `prometheus`, `alertmanager`, `loki`, `tempo`, `grafana`, `promtail`, `uptime-kuma` sont à l'état `exited` (présents, non actifs).

## Risques dominants

- Console de compte toujours en 26.7.0 : la route `applications` reste en erreur tant que 26.7.1 n'est pas déployé ; le masquage UI réduit l'exposition mais ne protège pas un accès direct à l'URL. Impact : console de compte partiellement indisponible en dev et en prod.
- Parité prod incomplète sur `KEYCLOAK_INTERNAL_ISSUER` : l'API prod retombe sur l'issuer externe pour `keycloak-admin.service.ts` (révocation de sessions, provisionnement). Impact : appels admin REST vers Keycloak défaillants selon le réseau prod.
- Secrets de dev par défaut (`Admin@1234`, `Telecom@2026!`, fallbacks JWT) : toute exécution non dev qui les conserverait expose l'authentification. Impact : compromission complète si déployé tel quel.
- Écart dev/prod non documenté (`KC_HTTP_RELATIVE_PATH`, observabilité éteinte) : risque de confusion lors du prochain déploiement. Impact : faible mais coûteux en debug.

## Recommandations retenues

- Monter Keycloak en 26.7.1 dès que le réseau le permet (pull depuis un hôte avec accès ou miroir), rebuild de l'image, puis vérifier `/realms/telecom/account/applications` en navigateur — cible : `keycloak-theme/Dockerfile:22` + `docker-compose.yml` service keycloak.
- Une fois 26.7.1 vérifié, réactiver l'entrée « Applications » dans la sidebar de la console — cible : `keycloak-theme/src/account/Template.tsx:99-101`.
- Ajouter `KEYCLOAK_INTERNAL_ISSUER` au service `api` de `docker-compose.prod.yml` (valeur interne type `http://keycloak:8080/realms/telecom`, alignée sur le dev) — cible : `docker-compose.prod.yml`, service api.
- Garder les `:?` du compose prod et interdire les fallbacks dev hors `NODE_ENV=development` ; vérifier qu'aucun secret n'est committé — cible : `docker-compose.prod.yml`, `docs/quick-start.md`, `.gitignore`.
- Aligner ou documenter `KC_HTTP_RELATIVE_PATH` entre dev et prod — cible : `docker-compose.prod.yml`, service keycloak.
- Validation navigateur par l'utilisateur : login SSO superviseur, pages dashboard/audit/rapports, changement de mot de passe, console de compte.

## Verdict / État

- Correctif des 403 superviseur : PRÊT côté code et tests (583 tests / 89 suites exécutés, health HTTP 200, guards et nav vérifiés). La preuve navigateur d'un vrai parcours superviseur reste [NON EXÉCUTÉ].
- Console de compte : PAS PRÊT tant que 26.7.1 n'est pas déployé ; la mitigation UI est en place mais la route reste cassée sur 26.7.0. Aucun P0 constaté ; P1 identifié : `KEYCLOAK_INTERNAL_ISSUER` manquant sur l'API en compose prod.

## Prochaines étapes

1. Relancer le pull/build 26.7.1 (réseau ou miroir) et confirmer l'image en cours (`docker compose ps`, jars `26.7.1`).
2. Vérifier en navigateur : console de compte (applications après upgrade), changement de mot de passe, accès superviseur aux pages dashboard/audit/rapports.
3. Corriger `docker-compose.prod.yml` (api : `KEYCLOAK_INTERNAL_ISSUER`) et trancher `KC_HTTP_RELATIVE_PATH` prod.
4. Réactiver l'entrée « Applications » dans `Template.tsx` après validation 26.7.1.
5. Revoir les secrets de dev avant toute mise en production (défauts `Admin@1234`/`Telecom@2026!`/JWT) et aligner la documentation si besoin.
