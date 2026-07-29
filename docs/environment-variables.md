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
| `DASHBOARD_URL` | ❌          | `http://localhost:3001`          | URL du frontend                                     |

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

## JWT

| Variable                  | Obligatoire | Défaut         | Description                    |
| ------------------------- | ----------- | -------------- | ------------------------------ |
| `JWT_ACCESS_SECRET`       | ✅          | _(à changer)_  | Secret pour les access tokens  |
| `JWT_REFRESH_SECRET`      | ✅          | _(à changer)_  | Secret pour les refresh tokens |
| `JWT_ACCESS_EXPIRATION`   | ❌          | `15m`          | Durée de vie access token      |
| `JWT_REFRESH_EXPIRATION`  | ❌          | `7d`           | Durée de vie refresh token     |
| `AUTH_ACCESS_COOKIE_NAME` | ❌          | `access_token` | Nom du cookie (mode BFF)       |

> ⚠️ En production, `JWT_ACCESS_SECRET` et `JWT_REFRESH_SECRET` doivent être des chaînes aléatoires d'au moins 32 caractères.

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

| Variable             | Défaut      | Description            |
| -------------------- | ----------- | ---------------------- |
| `BULLBOARD_USER`     | `admin`     | Utilisateur BullBoard  |
| `BULLBOARD_PASSWORD` | `bullboard` | Mot de passe BullBoard |

Accessible sur `http://localhost:3000/admin/queues`.

---

## Reports

| Variable                      | Défaut        | Description                             |
| ----------------------------- | ------------- | --------------------------------------- |
| `REPORT_DOWNLOAD_SECRET`      | _(à changer)_ | Secret pour les liens de téléchargement |
| `REPORT_DOWNLOAD_TTL_SECONDS` | `604800`      | Durée de validité du lien (7 jours)     |
