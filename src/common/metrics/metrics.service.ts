import { Injectable, OnModuleInit } from '@nestjs/common';
import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';

/**
 * Service de métriques Prometheus.
 * Expose les métriques au format OpenMetrics sur /metrics.
 *
 * Métriques collectées:
 * - http_requests_total (counter) — requêtes HTTP par méthode, route, statut
 * - http_request_duration_seconds (histogram) — durée des requêtes
 * - tickets_created_total (counter) — tickets créés par priorité
 * - tickets_active (gauge) — tickets actifs
 * - db_pool_connections (gauge) — connexions DB actives
 */
@Injectable()
export class MetricsService implements OnModuleInit {
  private readonly registry: Registry;

  // ─── Métriques HTTP ─────────────────────────────────────
  readonly httpRequestsTotal: Counter;
  readonly httpRequestDuration: Histogram;

  // ─── Métriques métier ───────────────────────────────────
  readonly ticketsCreatedTotal: Counter;
  readonly ticketsActive: Gauge;
  readonly slaBreachesTotal: Counter;

  // ─── Métriques système ──────────────────────────────────
  readonly dbPoolConnections: Gauge;

  constructor() {
    this.registry = new Registry();

    // Métriques par défaut (CPU, mémoire, event loop)
    collectDefaultMetrics({ register: this.registry, prefix: 'telecom_' });

    this.httpRequestsTotal = new Counter({
      name: 'telecom_http_requests_total',
      help: 'Nombre total de requêtes HTTP',
      labelNames: ['method', 'route', 'status_code'],
      registers: [this.registry],
    });

    this.httpRequestDuration = new Histogram({
      name: 'telecom_http_request_duration_seconds',
      help: 'Durée des requêtes HTTP en secondes',
      labelNames: ['method', 'route'],
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
      registers: [this.registry],
    });

    this.ticketsCreatedTotal = new Counter({
      name: 'telecom_tickets_created_total',
      help: 'Nombre total de tickets créés',
      labelNames: ['priority', 'category'],
      registers: [this.registry],
    });

    this.ticketsActive = new Gauge({
      name: 'telecom_tickets_active',
      help: 'Nombre de tickets actifs (non résolus)',
      registers: [this.registry],
    });

    this.slaBreachesTotal = new Counter({
      name: 'telecom_sla_breaches_total',
      help: 'Nombre total de violations SLA',
      labelNames: ['priority'],
      registers: [this.registry],
    });

    this.dbPoolConnections = new Gauge({
      name: 'telecom_db_pool_connections',
      help: 'Connexions actives au pool PostgreSQL',
      registers: [this.registry],
    });
  }

  onModuleInit(): void {
    // Initialiser les jauges
    this.dbPoolConnections.set(0);
    this.ticketsActive.set(0);
  }

  /**
   * Retourne les métriques au format Prometheus (text/plain).
   */
  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }
}
