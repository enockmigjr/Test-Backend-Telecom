# Observabilité — Comment ça marche

## Architecture

```
NestJS (Pino JSON)
  │
  ├── Logs structurés ──→ stdout ──→ Promtail (Docker SD) ──→ Loki ──→ Grafana
  ├── /metrics ──→ Prometheus (scrape 15s) ──→ Grafana ──→ Alertes
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

## Alertes Prometheus

**Fichier**: `prometheus/alert.rules.yml`

| Règle | Condition | Sévérité |
|-------|-----------|----------|
| ApiDown | `up{job="telecom-api"} == 0` > 2min | Critical |
| HighErrorRate | 5xx > 5% sur 5min | Critical |
| HighLatency | P95 > 2s sur 5min | Warning |
| SlaBreachRate | SLA breaches sur 15min | Warning |
| HighDbConnections | DB pool > 15 | Warning |
| HighMemoryUsage | Heap > 90% | Warning |

## Logs avec Pino + Loki

**Format JSON structuré**:
```json
{
  "level": 30,
  "time": "2026-06-29T17:00:00.000Z",
  "msg": "Ticket créé",
  "correlationId": "abc-123",
  "ticketNumber": "INC-2026-000042",
  "userId": "...",
  "context": "TicketsService"
}
```

**Flux**: NestJS (Pino) → stdout → Docker logs → Promtail (Docker SD) → Loki → Grafana

**Correlation ID**: Chaque requête a un `X-Correlation-Id` (généré ou propagé). Permet de tracer une requête à travers tous les logs. Dans Grafana, on peut chercher par `correlationId` pour voir tous les logs d'une requête.

**Fichiers config**: `loki/loki-config.yml`, `promtail/promtail-config.yml`

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

## Grafana

**URL**: `http://localhost:3001` (admin/admin)

**Datasources**: `grafana/datasources/datasources.yml`
- Prometheus (défaut)
- Loki (avec derived field correlationId)
- Tempo (avec trace→log linking)

**Dashboards**: `grafana/dashboards/`
- `application.json` — métriques NestJS (HTTP rate, latence, tickets, SLA, DB, heap)
- `business.json` — métriques métier (status, priority, compliance, erreurs)

## Uptime Kuma

**URL**: `http://localhost:3002`

Ping externe `GET /api/v1/health` toutes les 60s. Alerte si l'API ne répond pas.

## Activation/Désactivation

Par défaut, OpenTelemetry est activé. Pour désactiver:
```bash
OTEL_ENABLED=false pnpm run start:dev
```

Les services Prometheus, Loki, Tempo, Grafana sont dans Docker Compose. Pour ne pas les lancer:
```bash
docker compose up -d postgres redis api mailpit  # Sans observabilité
```
