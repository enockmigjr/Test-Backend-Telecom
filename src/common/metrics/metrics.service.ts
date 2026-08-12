/**
 * ============================================================================
 * FICHIER : src/common/metrics/metrics.service.ts
 * RÔLE : Service de collecte et de registre des métriques Prometheus (`prom-client`).
 * EXPLICATION :
 * Ce service centralise la définition et l'enregistrement de l'ensemble des métriques de l'application télécom :
 * 1. Collecte automatique des métriques système (Process CPU, mémoire RSS/Heap, Event Loop Lag) avec le préfixe `telecom_`.
 * 2. Compteurs & Histogrammes HTTP : volumétrie (`telecom_http_requests_total`) et latence (`telecom_http_request_duration_seconds`).
 * 3. Métriques métier : tickets créés (`telecom_tickets_created_total`), tickets ouverts (`telecom_tickets_active`), violations SLA (`telecom_sla_breaches_total`).
 * 4. Métriques temps réel et DB : sessions WebSocket (`telecom_ws_connections`), utilisateurs actifs (`telecom_active_users`) et connexions PostgreSQL (`telecom_db_pool_connections`).
 * ============================================================================
 */

import { Injectable, OnModuleInit } from '@nestjs/common';
import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';

/**
 * Service gérant le registre central des métriques et leur exportation au format OpenMetrics.
 */
@Injectable()
export class MetricsService implements OnModuleInit {
  private readonly registry: Registry;

  // ─── Métriques HTTP ─────────────────────────────────────
  /** Compteur total des requêtes HTTP reçues par méthode, route et statut. */
  readonly httpRequestsTotal: Counter;
  /** Histogramme des temps de réponse HTTP en secondes. */
  readonly httpRequestDuration: Histogram;

  // ─── Métriques métier ───────────────────────────────────
  /** Compteur total des tickets d'incidents créés par priorité et catégorie. */
  readonly ticketsCreatedTotal: Counter;
  /** Jauge des tickets actuellement ouverts et non résolus. */
  readonly ticketsActive: Gauge;
  /** Compteur total des pénalités/violations SLA détectées. */
  readonly slaBreachesTotal: Counter;
  /** Compteur des lectures ayant encore besoin de l'identite acteur historique. */
  readonly legacyTicketActorFallbackTotal: Counter;
  /** Compteur des passages du cron d'auto-assignation sans travail à faire (no-op). */
  readonly assignmentCronNoOpTotal: Counter;

  // ─── Métriques utilisateurs & WebSockets ────────────────
  /** Jauge du nombre d'utilisateurs uniques actuellement connectés. */
  readonly activeUsers: Gauge;
  /** Jauge du nombre de sockets WebSockets actifs. */
  readonly wsConnections: Gauge;

  // ─── Métriques système & BDD ────────────────────────────
  /** Jauge du nombre de connexions ouvertes dans le pool PostgreSQL Drizzle. */
  readonly dbPoolConnections: Gauge;

  constructor() {
    this.registry = new Registry();

    // Collecte des métriques système par défaut (CPU, mémoire, event loop)
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
      labelNames: ['priority', 'target'],
      registers: [this.registry],
    });

    this.legacyTicketActorFallbackTotal = new Counter({
      name: 'telecom_legacy_ticket_actor_fallback_total',
      help: "Nombre de lectures utilisant encore l'identite acteur historique",
      labelNames: ['surface'],
      registers: [this.registry],
    });

    this.assignmentCronNoOpTotal = new Counter({
      name: 'telecom_assignment_cron_noop_total',
      help: "Nombre de passages du cron d'auto-assignation sans ticket à router (no-op)",
      registers: [this.registry],
    });

    this.activeUsers = new Gauge({
      name: 'telecom_active_users',
      help: "Nombre d'utilisateurs connectés (WebSocket)",
      registers: [this.registry],
    });

    this.wsConnections = new Gauge({
      name: 'telecom_ws_connections',
      help: 'Nombre de connexions WebSocket actives',
      registers: [this.registry],
    });

    this.dbPoolConnections = new Gauge({
      name: 'telecom_db_pool_connections',
      help: 'Connexions actives au pool PostgreSQL',
      registers: [this.registry],
    });
  }

  /**
   * Initialise les valeurs par défaut des jauges au démarrage du module NestJS.
   */
  onModuleInit(): void {
    this.dbPoolConnections.set(0);
    this.ticketsActive.set(0);
  }

  /**
   * Exporte l'ensemble des métriques enregistrées sous forme de chaîne au format OpenMetrics textuel.
   *
   * @returns La représentation texte destinée au scraping Prometheus.
   */
  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }
}
