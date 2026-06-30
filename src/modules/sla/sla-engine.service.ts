import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { and, lt, gte, eq, notInArray } from 'drizzle-orm';
import { DrizzleProvider } from '../../database/drizzle.provider';
import { tickets } from '../../database/schemas';
import { MetricsService } from '../../common/metrics/metrics.service';

/**
 * Moteur de vérification des SLA.
 * Exécuté périodiquement via cron pour détecter les dépassements
 * et avertissements SLA sur les tickets actifs.
 */
@Injectable()
export class SlaEngineService {
  private readonly logger = new Logger(SlaEngineService.name);

  /** Statuts considérés comme terminés (hors surveillance SLA) */
  private static readonly CLOSED_STATUSES: Array<typeof tickets.$inferSelect.status> = [
    'RESOLVED',
    'CLOSED',
    'CANCELLED',
  ];

  constructor(
    private readonly drizzle: DrizzleProvider,
    private readonly metricsService: MetricsService,
  ) {}

  /**
   * Cron toutes les 5 minutes — vérifie les SLA.
   * Phase 1: détection des breaches (dépassement de l'échéance).
   * Phase 2: détection des warnings (échéance dans moins de 30 minutes).
   */
  @Cron('*/5 * * * *')
  async checkSla(): Promise<void> {
    this.logger.debug('Vérification périodique des SLA...');

    const now = new Date();
    const warningThreshold = new Date(now.getTime() + 30 * 60 * 1000);

    // Tickets en breach (date dépassée, pas encore marqué comme breached)
    const breachedTickets = await this.drizzle.db
      .select({ id: tickets.id, ticketNumber: tickets.ticketNumber })
      .from(tickets)
      .where(
        and(
          lt(tickets.resolutionDueAt, now),
          eq(tickets.slaBreached, false),
          notInArray(tickets.status, SlaEngineService.CLOSED_STATUSES),
        ),
      )
      .limit(100);

    for (const ticket of breachedTickets) {
      this.logger.warn(`SLA Breach détecté: ${ticket.ticketNumber}`);
      // Marquer comme breached
      await this.drizzle.db.update(tickets).set({ slaBreached: true }).where(eq(tickets.id, ticket.id));
      // Métrique Prometheus
      this.metricsService.slaBreachesTotal.inc({ priority: 'unknown' });
    }

    // Tickets en warning (échéance dans moins de 30 minutes)
    const warningTickets = await this.drizzle.db
      .select({ id: tickets.id, ticketNumber: tickets.ticketNumber })
      .from(tickets)
      .where(
        and(
          gte(tickets.resolutionDueAt, now),
          lt(tickets.resolutionDueAt, warningThreshold),
          notInArray(tickets.status, SlaEngineService.CLOSED_STATUSES),
          eq(tickets.slaBreached, false),
        ),
      )
      .limit(100);

    for (const ticket of warningTickets) {
      this.logger.warn(`SLA Warning: ${ticket.ticketNumber} — échéance imminente (< 30 min)`);
    }

    if (breachedTickets.length > 0 || warningTickets.length > 0) {
      this.logger.log(`SLA check terminé: ${breachedTickets.length} breaches, ${warningTickets.length} warnings`);
    }
  }

  /**
   * Calcule la date d'échéance SLA pour un ticket.
   */
  calculateDueDate(createdAt: Date, resolutionMinutes: number): Date {
    return new Date(createdAt.getTime() + resolutionMinutes * 60 * 1000);
  }
}
