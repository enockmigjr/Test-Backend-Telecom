# Observabilité — Comment ça marche

## Architecture

```
NestJS (Pino JSON)
  │
  ├── Logs structurés ──→ stdout ──→ Promtail (Docker SD) ──→ Loki ──→ Grafana
  ├── /metrics ──→ Prometheus (scrape 15s) ──→ Grafana ──→ Alertmanager ──→ Email + WhatsApp
  └── Traces OTLP ──→ Tempo ──→ Grafana (trace→log via correlationId)
```

## Métriques Prometheus

**Endpoint**: `GET /api/v1/metrics` (OpenMetrics, public)

| Métrique | Type | Description |
|----------|------|-------------|
| `telecom_http_requests_total` | Counter | Requêtes HTTP par méthode, route, status |
| `telecom_http_request_duration_seconds` | Histogram | Durée P50/P90/P99 par route |
| `telecom_tickets_created_total` | Counter | Tickets créés par priorité, catégorie |
| `telecom_tickets_active` | Gauge | Tickets actifs (non résolus) |
| `telecom_sla_breaches_total` | Counter | Violations SLA par priorité |
| `telecom_db_pool_connections` | Gauge | Connexions PostgreSQL actives |
| `telecom_active_users` | Gauge | Utilisateurs connectés (WebSocket) |
| `telecom_ws_connections` | Gauge | Connexions WebSocket actives |
| `telecom_nodejs_*` | Defaults | CPU, mémoire heap, event loop |

**Fichier config**: `prometheus/prometheus.yml` — scrape toutes les 15s sur `api:3000`

## Alertes Prometheus → Alertmanager

**Fichier règles**: `prometheus/alert.rules.yml`
**Fichier config Alertmanager**: `alertmanager/alertmanager.yml`

### Flux des alertes
1. Prometheus évalue les règles toutes les 15s
2. Si une condition est remplie pendant la durée `for`, l'alerte passe en `FIRING`
3. Prometheus envoie l'alerte à Alertmanager (`alertmanager:9093`)
4. Alertmanager route selon la sévérité :
   - `critical` → Email (immédiat, répété toutes les 1h) + WhatsApp webhook
   - `warning` → Email (groupé toutes les 10min, répété toutes les 8h)

| Règle | Condition | Sévérité |
|-------|-----------|----------|
| ApiDown | `up{job="telecom-api"} == 0` > 2min | Critical |
| HighErrorRate | 5xx > 5% sur 5min | Critical |
| HighLatency | P95 > 2s sur 5min | Warning |
| SlaBreachRate | SLA breaches sur 15min | Warning |
| HighDbConnections | DB pool > 15 | Warning |
| HighMemoryUsage | Heap > 90% | Warning |

### Tester les alertes
```bash
# Voir les alertes actives dans Prometheus
curl http://localhost:9090/api/v1/alerts

# Voir le statut Alertmanager
curl http://localhost:9093/api/v2/alerts

# Tester une alerte : arrêter l'API 2 minutes
docker compose stop api && sleep 120 && docker compose start api

# Vérifier les emails dans Mailpit
# http://localhost:9025
```

### Configuration WhatsApp (CallMeBot gratuit)

**CallMeBot** permet d'envoyer des alertes WhatsApp gratuitement via une API HTTP.

#### Étape 1 : Obtenir la clé API
1. Ajouter le numéro **+34 644 51 95 23** dans vos contacts WhatsApp
2. Envoyer le message exact suivant à ce contact :
   ```
   I allow callmebot to send me messages
   ```
3. Vous recevrez un message de confirmation avec votre **clé API** (ex: `XXXXXX`)

#### Étape 2 : Configurer Alertmanager
Dans `alertmanager/alertmanager.yml`, décommenter le bloc `webhook_configs` du receiver `critical-alerts` et remplacer :
```yaml
webhook_configs:
  - url: 'https://api.callmebot.com/whatsapp.php?phone=33612345678&apikey=XXXXXX&text={{ template "telecom.webhook.body" . }}'
    send_resolved: true
    http_config:
      follow_redirects: true
    max_alerts: 5
```
- `phone` : votre numéro au format international (336... pour la France, sans le +)
- `apikey` : la clé reçue par WhatsApp

#### Étape 3 : Redémarrer Alertmanager
```bash
docker compose restart alertmanager
```

> **Note** : CallMeBot a une limite de ~80 messages par jour en version gratuite. Pour un usage production, utiliser Twilio ou l'API WhatsApp Business.

## Logs avec Pino + Loki

**Format JSON structuré** (Pino avec `formatters.level`):
```json
{"level":"info","time":"2026-06-29T17:00:00.000Z","msg":"Ticket créé","correlationId":"abc-123","ticketNumber":"INC-2026-000042","context":"TicketsService"}
```

**Flux**: NestJS (Pino) → stdout → Docker logs → Promtail (Docker SD) → Loki → Grafana

**Correlation ID**: Chaque requête a un `X-Correlation-Id` (généré ou propagé). Permet de tracer une requête à travers tous les logs. Dans Grafana, chercher par `correlationId` pour voir tous les logs d'une requête.

**Labels dans Loki par service**:
| Service | log_type | Niveau de log |
|---------|----------|---------------|
| telecom-api | application | info, warn, error, debug |
| postgresql | database | log, error, fatal |
| redis | cache | debug, info, notice, verbose |
| nginx | proxy | (via http_status) |
| prometheus/loki/tempo/grafana | infrastructure | info, error |

**Fichiers config**: `loki/loki-config.yml`, `promtail/promtail-config.yml`

### Requêtes Loki utiles
```logql
# Tous les logs d'un correlationId spécifique
{correlationId="abc-123"}

# Erreurs de l'API
{log_type="application", level="error"}

# Logs PostgreSQL uniquement
{log_type="database"}

# Logs Redis uniquement  
{log_type="cache"}

# Recherche texte dans les messages
{log_type="application"} |= "ticket"
```

## Traces avec OpenTelemetry + Tempo

**SDK**: `src/common/observability/otel.ts` — initialisé avant NestFactory dans `main.ts`

**Instrumentations automatiques**:
- HTTP (requêtes entrantes/sortantes)
- Express (middleware)
- NestJS (controllers, providers)
- PostgreSQL (requêtes SQL)
- Redis (commandes ioredis)

**Export**: OTLP HTTP → Tempo (`http://tempo:4318/v1/traces`)

**Fichier config**: `tempo/tempo-config.yml`

**Vérification**:
```bash
# Vérifier que Tempo reçoit des traces
docker logs telecom-tempo | grep "traces"

# Dans Grafana → Explore → Tempo → chercher par service.name=telecom-api
```

## Grafana

**URL**: `http://localhost:3001` (admin/admin)

**Datasources**: `grafana/datasources/datasources.yml`
- Prometheus (défaut) — métriques temps réel
- Loki (avec derived field correlationId pour lier traces et logs)
- Tempo (avec trace→log linking via Loki)

**Dashboards**: `grafana/dashboards/`
- `application.json` — Métriques techniques (HTTP rate, latence P50/P95, tickets, SLA, DB, heap, event loop, uptime)
- `business.json` — Métriques métier (tickets par statut/priorité, SLA compliance, erreurs, tendances)

## Uptime Kuma

**URL**: `http://localhost:3002`

### Configuration initiale
1. Ouvrir `http://localhost:3002` → créer un compte admin
2. Ajouter les moniteurs suivants :

| Nom | Type | URL | Intervalle |
|-----|------|-----|------------|
| API Health | HTTP(s) | `http://api:3000/api/v1/health` | 60s |
| API Ready | HTTP(s) | `http://api:3000/api/v1/health/ready` | 60s |
| Grafana | HTTP(s) | `http://grafana:3000/api/health` | 120s |
| Prometheus | HTTP(s) | `http://prometheus:9090/-/healthy` | 120s |
| Alertmanager | HTTP(s) | `http://alertmanager:9093/-/healthy` | 120s |

3. Configurer les notifications Uptime Kuma (optionnel) :
   - Webhook → URL Prometheus Alertmanager ou Slack
   - Email → via SMTP Mailpit (`mailpit:1025`)

### API pour configurer les moniteurs automatiquement
Uptime Kuma expose une API REST qui permet de créer des moniteurs programmatiquement. Voir la [doc API](https://github.com/louislam/uptime-kuma/wiki/API).

## Activation/Désactivation

**OpenTelemetry** (par défaut activé) :
```bash
OTEL_ENABLED=false pnpm run start:dev
```

**Services d'observabilité uniquement** :
```bash
docker compose up -d prometheus loki tempo grafana promtail alertmanager
```

**Sans observabilité** :
```bash
docker compose up -d postgres redis api nginx mailpit
```

## Architecture des conteneurs

```
┌─────────────────────────────────────────────────────────┐
│                    telecom-network                       │
│                                                         │
│  ┌──────┐  ┌──────┐  ┌──────┐  ┌────────┐  ┌────────┐ │
│  │  API │  │  DB  │  │Redis │  │ Nginx  │  │Mailpit │ │
│  │:3000 │  │:5432 │  │:6379 │  │:80/443 │  │:1025   │ │
│  └──┬───┘  └──────┘  └──────┘  └────────┘  └────────┘ │
│     │                                                    │
│     ├── traces OTLP ──→ Tempo (:4318) ──→ Grafana       │
│     ├── logs stdout ──→ Promtail ──→ Loki (:3100) ──┐   │
│     └── /metrics ──→ Prometheus (:9090) ──→ Grafana  │   │
│                          │                            │   │
│                    Alertmanager (:9093)               │   │
│                          │                            │   │
│                    Email (Mailpit :1025)              │   │
│                    WhatsApp (webhook)                 │   │
│                                                       │   │
│  ┌──────────┐  ┌────────┐                             │   │
│  │  Grafana │  │ Uptime │                             │   │
│  │  :3001   │  │ Kuma   │                             │   │
│  │          │  │ :3002  │                             │   │
│  └──────────┘  └────────┘                             │   │
└─────────────────────────────────────────────────────────┘
```
