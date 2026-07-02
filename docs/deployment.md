# Guide de Déploiement en Production

## Prérequis

- Node.js 22+
- pnpm 10+
- Docker & Docker Compose
- PostgreSQL 16 (ou le service Docker)
- Redis 7 (ou le service Docker)
- SMTP server pour les emails (ou utiliser Mailpit en dev)

## 1. Variables d'Environnement

Copier et adapter `.env.example` → `.env`:

```bash
# Production
NODE_ENV=production
JWT_ACCESS_SECRET=<générer 64 caractères aléatoires>
JWT_REFRESH_SECRET=<générer 64 caractères aléatoires>
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=noreply@example.com
SMTP_PASSWORD=<mot de passe SMTP>
SMTP_FROM=noreply@telecom-tickets.com
SMTP_SECURE=true
CORS_ORIGIN=https://votre-domaine.com
```

**Génération de secrets**:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

## 2. Base de Données

```bash
# Créer la séquence de numérotation des tickets
docker compose exec postgres psql -U telecom -d telecom_tickets \
  -c "CREATE SEQUENCE IF NOT EXISTS ticket_number_seq START 1 INCREMENT 1;"

# Pousser le schéma Drizzle
pnpm run db:push

# Insérer les données de test (optionnel en production)
pnpm run db:seed
```

## 3. Build et Démarrage

### Option A: Docker Compose (recommandé)

```bash
# Build l'image production
docker compose build api

# Démarrer tous les services
docker compose up -d

# Vérifier l'état
docker compose ps
docker compose logs api
```

### Option B: Sans Docker

```bash
pnpm install --frozen-lockfile
pnpm run build
NODE_ENV=production node dist/main.js
```

## 4. Health Checks

```bash
# Liveness
curl http://localhost:${API_PORT:-3000}/api/v1/health

# Readiness (DB + Redis)
curl http://localhost:${API_PORT:-3000}/api/v1/health/ready

# Métriques Prometheus
curl http://localhost:${API_PORT:-3000}/api/v1/metrics
```

## 5. BullBoard — Supervision des Queues

**URL**: `/admin/queues`

En développement, l'accès est libre. En production, l'accès est protégé par Basic Auth.

Configurer dans `.env` :

```env
BULLBOARD_USER=admin
BULLBOARD_PASSWORD=un-mot-de-passe-securise
```

Laisser ces variables vides ou non définies utilisera les valeurs par défaut (`admin` / `bullboard`), ce qui est déconseillé en production.

## 6. Monitoring

### Prometheus

Configurer Prometheus pour scraper `/api/v1/metrics`:

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'telecom-api'
    scrape_interval: 15s
    metrics_path: '/api/v1/metrics'
    static_configs:
      - targets: ['${API_HOST:-api}:${API_PORT:-3000}']
```

### Métriques Disponibles

| Métrique                                | Type      | Labels                     | Description              |
| --------------------------------------- | --------- | -------------------------- | ------------------------ |
| `telecom_http_requests_total`           | Counter   | method, route, status_code | Requêtes HTTP            |
| `telecom_http_request_duration_seconds` | Histogram | method, route              | Durée des requêtes       |
| `telecom_tickets_created_total`         | Counter   | priority, category         | Tickets créés            |
| `telecom_tickets_active`                | Gauge     | —                          | Tickets actifs           |
| `telecom_sla_breaches_total`            | Counter   | priority                   | Violations SLA           |
| `telecom_db_pool_connections`           | Gauge     | —                          | Connexions DB            |
| `telecom_nodejs_*`                      | Default   | —                          | CPU, mémoire, event loop |

## 6. Logs

Les logs sont émis au format JSON structuré via Pino.
En production, les logs sont écrits sur stdout (capturés par Docker).
Pour l'agrégation, configurer un driver Docker Loki ou un sidecar.

```bash
# Voir les logs en temps réel
docker compose logs -f api

# Filtrer les logs d'erreur
docker compose logs api | grep '"level":50'
```

## 7. Sécurité Checklist

- [ ] Changer les secrets JWT par défaut
- [ ] Configurer CORS pour le domaine de production
- [ ] Activer HTTPS/TLS sur Nginx
- [ ] Configurer les certificats SSL
- [ ] Limiter l'accès au port PostgreSQL (interne uniquement)
- [ ] Configurer un mot de passe Redis
- [ ] Activer `secure: true` sur les cookies si utilisés
- [ ] Vérifier que `NODE_ENV=production`
- [ ] Scanner les vulnérabilités: `pnpm audit`

## 8. Scaling

L'application est **stateless** et conçue pour le scaling horizontal:

```bash
# Augmenter les instances API
docker compose up -d --scale api=3
```

- **Sessions**: JWT (pas de session serveur)
- **Rate Limiting**: Redis partagé (fonctionne avec N instances)
- **Cache**: Redis partagé
- **Files d'attente**: BullMQ via Redis partagé
- **WebSocket**: Nécessite un adapter Redis pour multi-instance (à configurer)

## 9. Backup

```bash
# Backup PostgreSQL
docker compose exec postgres pg_dump -U telecom telecom_tickets > backup.sql

# Restore
docker compose exec -T postgres psql -U telecom telecom_tickets < backup.sql
```

## 10. Troubleshooting

| Problème                  | Solution                                                               |
| ------------------------- | ---------------------------------------------------------------------- |
| `ECONNREFUSED` PostgreSQL | Vérifier `DATABASE_URL` et que PostgreSQL est accessible               |
| `ECONNREFUSED` Redis      | Vérifier `REDIS_HOST`/`REDIS_PORT` et que Redis tourne                 |
| Erreur JWT                | Vérifier que `JWT_ACCESS_SECRET` et `JWT_REFRESH_SECRET` sont définis  |
| 502 Bad Gateway           | Vérifier les logs Nginx et API                                         |
| Emails non envoyés        | Vérifier la config SMTP et les logs du worker BullMQ                   |
| SLA non vérifiés          | Le cron tourne toutes les 5 min — vérifier les logs `SlaEngineService` |
