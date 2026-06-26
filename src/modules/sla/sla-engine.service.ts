import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { and, lt, gte, eq, sql } from 'drizzle-orm';
import { DrizzleProvider } from '../../database/drizzle.provider';
import { tickets } from '../../database/schemas';

@Injectable()
export class SlaEngineService {
  private readonly logger = new Logger(SlaEngineService.name);

  constructor(private readonly drizzle: DrizzleProvider) {}

  /**
   * Cron toutes les 5 minutes — vérifie les SLA.
   */
  @Cron('*/5 * * * *')
  async checkSla(): Promise<void> {
    this.logger.debug('Vérification périodique des SLA...');

    const now = new Date();
    const warningThreshold = new Date(now.getTime() + 30 * 60 * 1000); // +30 minutes

    const activeStatuses = ['RESOLVED', 'CLOSED', 'CANCELLED'] as const;

    // Tickets en breach (date dépassée, pas encore marqué)
    const breachedTickets = await this.drizzle.db
      .select({ id: tickets.id, ticketNumber: tickets.ticketNumber })
      .from(tickets)
      .where(
        and(
          lt(tickets.resolutionDueAt, now),
          eq(tickets.slaBreached, false),
          sql`${tickets.status} NOT IN (${activeStatuses.join(',')})`,
        ),
      )
      .limit(100);

    for (const ticket of breachedTickets) {
      this.logger.warn(`SLA Breach: ${ticket.ticketNumber}`);
      // Émettre événement SLA_BREACHED
    }

    // Tickets en warning (dans les 30 minutes)
    const warningTickets = await this.drizzle.db
      .select({ id: tickets.id, ticketNumber: tickets.ticketNumber })
      .from(tickets)
      .where(
        and(
          gte(tickets.resolutionDueAt, now),
          lt(tickets.resolutionDueAt, warningThreshold),
          sql`${tickets.status} NOT IN (${activeStatuses.join(',')})`,
        ),
      )
      .limit(100);

    for (const ticket of warningTickets) {
      this.logger.warn(`SLA Warning: ${ticket.ticketNumber} — échéance dans < 30 min`);
    }

    this.logger.debug(`SLA check terminé: ${breachedTickets.length} breaches, ${warningTickets.length} warnings`);
  }

  /**
   * Calcule la date d'échéance SLA pour un ticket.
   */
  calculateDueDate(createdAt: Date, resolutionMinutes: number): Date {
    return new Date(createdAt.getTime() + resolutionMinutes * 60 * 1000);
  }
}
