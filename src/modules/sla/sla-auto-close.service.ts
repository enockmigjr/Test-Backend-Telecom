import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { and, eq, isNull, lt } from 'drizzle-orm';
import { generateUuid } from '../../common/helpers/uuidv7.helper';
import { MetricsService } from '../../common/metrics/metrics.service';
import { DrizzleProvider } from '../../database/drizzle.provider';
import { ticketHistory, tickets, users } from '../../database/schemas';
import { TicketClosedEvent, TicketStatusChangedEvent } from '../tickets/domain/ticket.events';

@Injectable()
export class SlaAutoCloseService {
  private readonly logger = new Logger(SlaAutoCloseService.name);

  constructor(
    private readonly drizzle: DrizzleProvider,
    private readonly metricsService: MetricsService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async process(): Promise<void> {
    const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const resolvedTickets = await this.drizzle.db
      .select({ id: tickets.id, ticketNumber: tickets.ticketNumber })
      .from(tickets)
      .where(and(eq(tickets.status, 'RESOLVED'), lt(tickets.resolvedAt, cutoff), isNull(tickets.deletedAt)))
      .limit(100);

    if (resolvedTickets.length === 0) return;

    const [adminUser] = await this.drizzle.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, 'admin@telecom.local'))
      .limit(1);
    if (!adminUser) {
      this.logger.error("Impossible de proceder a l'auto-cloture : administrateur systeme introuvable.");
      return;
    }

    for (const ticket of resolvedTickets) {
      const closedAt = new Date();
      const claimed = await this.drizzle.db.transaction(async (transaction) => {
        const rows = await transaction
          .update(tickets)
          .set({ status: 'CLOSED', closedAt })
          .where(
            and(
              eq(tickets.id, ticket.id),
              eq(tickets.status, 'RESOLVED'),
              lt(tickets.resolvedAt, cutoff),
              isNull(tickets.deletedAt),
            ),
          )
          .returning({ id: tickets.id });
        if (rows.length === 0) return false;

        await transaction.insert(ticketHistory).values({
          id: generateUuid(),
          ticketId: ticket.id,
          userId: adminUser.id,
          action: 'STATUS_CHANGED',
          oldValue: { status: 'RESOLVED' },
          newValue: { status: 'CLOSED' },
          metadata: { reason: 'Cloture automatique apres 48 heures de resolution sans activite.' },
        });
        return true;
      });
      if (!claimed) continue;

      this.eventEmitter.emit(
        'ticket.status_changed',
        new TicketStatusChangedEvent(ticket.id, 'RESOLVED', 'CLOSED', adminUser.id),
      );
      this.eventEmitter.emit('ticket.closed', new TicketClosedEvent(ticket.id, adminUser.id));
      this.metricsService.ticketsActive.dec();
      this.logger.log(`Ticket ${ticket.ticketNumber} cloture automatiquement.`);
    }
  }
}
