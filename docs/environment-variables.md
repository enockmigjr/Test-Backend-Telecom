# Variables d'Environnement

Référence complète de toutes les variables d'environnement du backend.
Voir `.env.example` pour les valeurs par défaut.

---

## Application

| Variable        | Obligatoire | Défaut                           | Description                                         |
| --------------- | ----------- | -------------------------------- | --------------------------------------------------- |
| `NODE_ENV`      | ✅          | `development`                    | Environnement (`development`, `production`, `test`) |
| `PORT`          | ✅          | `3000`                           | Port de l'API                                       |
| `API_PREFIX`    | ✅          | `api/v1`                         | Préfixe des routes API                              |
| `APP_NAME`      | ❌          | `Helpdesk Telecom`               | Nom affiché dans les emails                         |
| `APP_URL`       | ❌          | `http://localhost:3000`          | URL publique de l'API                               |
| `LOGO_URL`      | ❌          | `http://localhost:3000/logo.png` | Logo dans les emails                                |
| `LOGIN_URL`     | ❌          | `http://localhost:3000/login`    | Lien login dans les emails                          |
| `DASHBOARD_URL` | ❌          | `http://localhost:3007`          | URL du frontend (3001 = Grafana)                    |

---

## Base de données PostgreSQL

| Variable                   | Obligatoire | Défaut             | Description               |
| -------------------------- | ----------- | ------------------ | ------------------------- |
| `DATABASE_HOST`            | ✅          | `localhost`        | Hôte PostgreSQL           |
| `DATABASE_PORT`            | ✅          | `5432`             | Port PostgreSQL           |
| `DATABASE_USER`            | ✅          | `telecom`          | Utilisateur DB            |
| `DATABASE_PASSWORD`        | ✅          | `telecom_secret`   | Mot de passe DB           |
| `DATABASE_NAME`            | ✅          | `telecom_tickets`  | Nom de la base            |
| `DATABASE_URL`             | ✅          | `postgresql://...` | URL de connexion complète |
| `DATABASE_MAX_CONNECTIONS` | ❌          | `500`              | Pool de connexions max    |

---

## Redis

| Variable         | Obligatoire | Défaut                   | Description        |
| ---------------- | ----------- | ------------------------ | ------------------ |
| `REDIS_HOST`     | ✅          | `localhost`              | Hôte Redis         |
| `REDIS_PORT`     | ✅          | `6379`                   | Port Redis         |
| `REDIS_PASSWORD` | ❌          | _(vide)_                 | Mot de passe Redis |
| `REDIS_URL`      | ✅          | `redis://localhost:6379` | URL de connexion   |

---

## Authentification (Keycloak)

| Variable                                     | Obligatoire | Défaut                                   | Description                                                                     |
| -------------------------------------------- | ----------- | ---------------------------------------- | ------------------------------------------------------------------------------- |
| `KEYCLOAK_ISSUER`                            | ✅          | `http://localhost:8081/realms/telecom`   | Issuer du realm (comparaison `iss`)                                             |
| `KEYCLOAK_INTERNAL_ISSUER`                   | ❌          | = `KEYCLOAK_ISSUER`                      | Issuer interne conteneurisé                                                     |
| `KEYCLOAK_JWKS_URL`                          | ❌          | `{issuer}/protocol/openid-connect/certs` | Clés publiques RS256                                                            |
| `KEYCLOAK_CLIENT_ID`                         | ❌          | `telecom-frontend`                       | Client OIDC du BFF                                                              |
| `KEYCLOAK_REDIRECT_URI`                      | ✅          | —                                        | Callback OIDC autorisé                                                          |
| `KEYCLOAK_ADMIN` / `KEYCLOAK_ADMIN_PASSWORD` | ✅ (prod)   | `admin` / dev                            | Compte admin (realm `master`)                                                   |
| `KEYCLOAK_EVENTS_SYNC_CRON`                  | ❌          | `*/5 * * * *`                            | Cron de synchro des événements vers `audit_logs` ; `disabled` arrête la synchro |
| `REFRESH_TOKENS_DROP_GRACE_DAYS`             | ❌          | `14`                                     | Fenêtre avant le DROP de `refresh_tokens`                                       |
| `AUTH_ACCESS_COOKIE_NAME`                    | ❌          | `access_token`                           | Nom du cookie (mode BFF)                                                        |

> Keycloak est l'unique fournisseur d'authentification : plus aucun secret de
> signature JWT applicatif (HS256) n'est requis pour l'API interne.

---

## Email (SMTP)

| Variable        | Obligatoire | Défaut                          | Description        |
| --------------- | ----------- | ------------------------------- | ------------------ |
| `SMTP_HOST`     | ✅          | `localhost`                     | Serveur SMTP       |
| `SMTP_PORT`     | ✅          | `1025`                          | Port SMTP          |
| `SMTP_USER`     | ❌          | _(vide)_                        | Utilisateur SMTP   |
| `SMTP_PASSWORD` | ❌          | _(vide)_                        | Mot de passe SMTP  |
| `SMTP_FROM`     | ✅          | `noreply@telecom-tickets.local` | Adresse expéditeur |
| `SMTP_SECURE`   | ❌          | `false`                         | TLS/SSL            |

> En développement, Mailpit capture tous les emails sur `http://localhost:8025`.

---

## Upload de fichiers

| Variable                | Obligatoire | Défaut      | Description                      |
| ----------------------- | ----------- | ----------- | -------------------------------- |
| `STORAGE_TYPE`          | ❌          | `local`     | Type de stockage (`local`, `s3`) |
| `STORAGE_LOCAL_PATH`    | ❌          | `./uploads` | Répertoire local                 |
| `STORAGE_MAX_FILE_SIZE` | ❌          | `10485760`  | Taille max en octets (10 MB)     |

---

## Rate Limiting

| Variable              | Obligatoire | Défaut    | Description                     |
| --------------------- | ----------- | --------- | ------------------------------- |
| `THROTTLE_TTL`        | ❌          | `900000`  | Fenêtre en ms (15 min)          |
| `THROTTLE_LIMIT`      | ❌          | `1000`    | Requêtes max par fenêtre        |
| `THROTTLE_AUTH_TTL`   | ❌          | `3600000` | Fenêtre auth en ms (1 heure)    |
| `THROTTLE_AUTH_LIMIT` | ❌          | `20`      | Tentatives auth max par fenêtre |

---

## CORS

| Variable      | Obligatoire | Défaut                      | Description                                     |
| ------------- | ----------- | --------------------------- | ----------------------------------------------- |
| `CORS_ORIGIN` | ✅          | `http://localhost:5173,...` | Origines autorisées (séparées par des virgules) |

---

## Observabilité

| Variable                      | Défaut                        | Description           |
| ----------------------------- | ----------------------------- | --------------------- |
| `LOG_LEVEL`                   | `debug`                       | Niveau de log Pino    |
| `OTEL_ENABLED`                | `true`                        | Activer OpenTelemetry |
| `OTEL_SERVICE_NAME`           | `telecom-api`                 | Nom du service OTel   |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `http://tempo:4318/v1/traces` | Endpoint Tempo        |
| `GRAFANA_ADMIN_USER`          | `admin`                       | Utilisateur Grafana   |
| `GRAFANA_ADMIN_PASSWORD`      | `admin`                       | Mot de passe Grafana  |

---

## BullBoard

| Variable             | Défaut            | Description                                                    |
| -------------------- | ----------------- | -------------------------------------------------------------- |
| `BULLBOARD_USER`     | `admin` (dev)     | Utilisateur BullBoard — **requis en prod** (`timingSafeEqual`) |
| `BULLBOARD_PASSWORD` | `bullboard` (dev) | Mot de passe BullBoard — **requis en prod** (500 si absent)    |

Accessible sur `http://localhost:3000/api/v1/admin/queues` (`basePath = ${API_PREFIX}/admin/queues`). En prod via Nginx IP allowlist recommandée.

---

## Reports

| Variable                      | Défaut        | Description                                                     |
| ----------------------------- | ------------- | --------------------------------------------------------------- |
| `REPORT_DOWNLOAD_SECRET`      | _(à changer)_ | Secret HMAC 32+ — **gating même hors prod** (throw si manquant) |
| `REPORT_DOWNLOAD_TTL_SECONDS` | `172800` (2j) | Durée de validité du lien (défaut durci de 604800 → 172800)     |

---

## Support public (identité et session)

| Variable                                            | Défaut                                          | Description                                                             |
| --------------------------------------------------- | ----------------------------------------------- | ----------------------------------------------------------------------- |
| `PUBLIC_SUPPORT_MASTER_KEYS`                        | obligatoire                                     | Clés maîtresses AES-256 versionnées (base64, séparées par des virgules) |
| `PUBLIC_SUPPORT_MASTER_KEY_VERSION`                 | `1`                                             | Version de clé maîtresse courante                                       |
| `METRICS_SCRAPE_TOKEN`                              | _(vide, ouvert)_                                | Bearer requis pour `GET /metrics` si défini (`timingSafeEqual`)         |
| `TICKET_REOPEN_SLA_MINUTES`                         | `240`                                           | Rallonge SLA à la réouverture (24_7 pour CRITICAL/HIGH)                 |
| `AUTH_REDIS_BLACKLIST_FAIL_OPEN`                    | `true` (dev) / `false` (prod)                   | `false` en prod = fail-closed si Redis down                             |
| `PUBLIC_SUPPORT_CONTACT_HASH_SECRET`                | obligatoire (≥ 32 car.)                         | HMAC des contacts et quotas publics                                     |
| `PUBLIC_SESSION_SECRET`                             | obligatoire (≥ 32 car.)                         | Signature des sessions publiques (distinct du JWT interne)              |
| `PUBLIC_SESSION_TTL_SECONDS`                        | `900`                                           | Durée d'une session publique (300-3600)                                 |
| `PUBLIC_SESSION_ISSUER` / `PUBLIC_SESSION_AUDIENCE` | `telecom-public-support` / `telecom-public-bff` | Issuer/audience des sessions publiques                                  |
| `PUBLIC_SUPPORT_DEVICE_TRUST_DAYS`                  | `90`                                            | Validité d'un appareil de confiance                                     |
| `PUBLIC_SUPPORT_DEVICE_POLICY_VERSION`              | `1`                                             | Version de la politique d'appareils                                     |
| `PUBLIC_SUPPORT_OTP_TTL_SECONDS`                    | `600`                                           | Durée de vie d'un code OTP                                              |
| `PUBLIC_SUPPORT_OTP_MAX_ATTEMPTS`                   | `5`                                             | Tentatives maximales par challenge                                      |
| `PUBLIC_SUPPORT_OTP_RESEND_SECONDS`                 | `60`                                            | Délai avant renvoi                                                      |
| `PUBLIC_ASSERTION_AUDIENCE`                         | `telecom-integration-assertion`                 | Audience des assertions WordPress                                       |
| `PUBLIC_ASSERTION_MAX_AGE_SECONDS`                  | `120`                                           | Durée de vie d'une assertion (30-300)                                   |
| `PUBLIC_BOOTSTRAP_TTL_SECONDS`                      | `120`                                           | Durée d'un code de transfert iframe                                     |
| `PUBLIC_SUPPORT_ORIGINS`                            | `http://localhost:3005`                         | Origines autorisées pour le WebSocket public                            |
| `PUBLIC_PORTAL_ORIGIN`                              | `http://localhost:3005`                         | Origine du portail public (liens de satisfaction)                       |
| `PUBLIC_WS_COOKIE_NAME`                             | `support_session,support_iframe_session`        | Noms des cookies publics (préfixe `__Host-` en prod)                    |
| `PUBLIC_SUPPORT_RETENTION_INACTIVE_DAYS`            | `395`                                           | Inactivité avant anonymisation d'un demandeur                           |
| `PUBLIC_SUPPORT_SECRET_GRACE_MINUTES`               | `15`                                            | Grâce d'un secret d'intégration révoqué                                 |

## Bot (support public)

| Variable                                | Défaut                          | Description                                                                          |
| --------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------ |
| `PUBLIC_SUPPORT_BOT_PROVIDER`           | `none`                          | `openai-compatible` ou `deepseek` pour activer                                       |
| `PUBLIC_SUPPORT_BOT_API_KEY`            | `REPLACE_ME`                    | Clé API du fournisseur — **jamais committée** (`sk-…` interdite dans `.env.example`) |
| `PUBLIC_SUPPORT_BOT_BASE_URL`           | selon fournisseur               | Base URL du fournisseur compatible OpenAI                                            |
| `PUBLIC_SUPPORT_BOT_MODEL`              | `gpt-4o-mini` / `deepseek-chat` | Modèle utilisé                                                                       |
| `PUBLIC_SUPPORT_BOT_MAX_TOKENS`         | `800`                           | Max tokens par réponse                                                               |
| `PUBLIC_SUPPORT_BOT_TIMEOUT_MS`         | `20000`                         | Timeout du fournisseur                                                               |
| `PUBLIC_SUPPORT_BOT_DAILY_BUDGET`       | `200`                           | Appels bot par jour par intégration                                                  |
| `PUBLIC_SUPPORT_BOT_CIRCUIT_OPEN_AFTER` | `5`                             | Échecs avant ouverture du circuit breaker                                            |
| `PUBLIC_SUPPORT_BOT_CIRCUIT_OPEN_MS`    | `600000`                        | Durée d'ouverture du circuit breaker                                                 |
| `PUBLIC_SUPPORT_BOT_PROMPT_VERSION`     | `2026-08-v1`                    | Version du prompt système                                                            |

## ClamAV et quarantaine

| Variable                                | Défaut               | Description                |
| --------------------------------------- | -------------------- | -------------------------- |
| `CLAMAV_HOST` / `CLAMAV_PORT`           | `localhost` / `3310` | Hôte du scanner antivirus  |
| `CLAMAV_TIMEOUT_MS`                     | `10000`              | Timeout du scan            |
| `CLAMAV_MAX_FILE_SIZE`                  | `10485760`           | Taille max scannée (10 Mo) |
| `ATTACHMENT_QUARANTINE_RETENTION_HOURS` | `24`                 | Rétention des quarantaines |

## SSO Keycloak (en cours)

| Variable                  | Défaut                                             | Description                                                                           |
| ------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `KEYCLOAK_ISSUER`         | `http://localhost:8081/realms/telecom`             | Issuer du realm Keycloak (JWKS RS256) — port 8081 car 8080 est utilisé par PhotoVault |
| `KEYCLOAK_ADMIN`          | `admin`                                            | Compte admin du conteneur                                                             |
| `KEYCLOAK_ADMIN_PASSWORD` | `Admin@1234`                                       | Mot de passe admin (dev)                                                              |
| `KEYCLOAK_REDIRECT_URI`   | `http://localhost:3007/api/auth/keycloak/callback` | URI de callback du BFF                                                                |

> Référence complète : 146 variables documentées dans `.env.example` (hardening 20/08 : `METRICS_SCRAPE_TOKEN`, `TICKET_REOPEN_SLA_MINUTES`, `AUTH_REDIS_BLACKLIST_FAIL_OPEN`).
