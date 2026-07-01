import { Injectable, Logger, Inject } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Queue } from 'bullmq';
import { SLA_QUEUE } from '../../../queues/queues.module';
import { TicketCreatedEvent, TicketResolvedEvent, TicketClosedEvent } from '../domain/ticket.events';

interface BullMqQueues {
  sla: Queue;
  [key: string]: Queue;
}

/**
 * Listener SLA pour les événements de domaine Ticket.
 * Planifie des vérifications SLA retardées dans la SLA_QUEUE.
 *
 * NOTE : Injecte le token global 'BullMQ_Queues' — connexions Redis partagées.
 *
 * RESILIENCE : Les appels BullMQ sont dans un try/catch pour ne jamais
 * bloquer la requête HTTP principale en cas d'indisponibilité Redis.
 */
@Injectable()
export class TicketSlaListener {
  private readonly logger = new Logger(TicketSlaListener.name);

  constructor(@Inject('BullMQ_Queues') private readonly queues: BullMqQueues) {}

  private get slaQueue(): Queue {
    return this.queues[SLA_QUEUE] ?? this.queues['sla'];
  }

  @OnEvent('ticket.created')
  async handleCreated(event: TicketCreatedEvent): Promise<void> {
    const resolutionDueAt = event.ticket['resolutionDueAt'] as string;
    const delay = this.calculateDelay(resolutionDueAt);

    if (delay > 0) {
      try {
        await this.slaQueue.add(
          'check_breach',
          { ticketId: event.ticket['id'] as string, action: 'check_breach' },
          { delay, jobId: `sla-breach-${event.ticket['id'] as string}` },
        );
        this.logger.debug(
          `Vérification SLA planifiée dans ${Math.round(delay / 60000)}min pour ticket ${event.ticket['ticketNumber']}`,
        );
      } catch (err) {
        this.logger.warn(`SLA queue unavailable. Breach check not scheduled: ${String(err)}`);
      }
    }
  }

  @OnEvent('ticket.resolved')
  async handleResolved(event: TicketResolvedEvent): Promise<void> {
    // Supprimer le job de vérification SLA si le ticket est résolu avant échéance
    await this.slaQueue.remove(`sla-breach-${event.ticketId}`).catch(() => {});
    this.logger.debug(`Ticket ${event.ticketId} résolu — job SLA breach annulé`);
  }

  @OnEvent('ticket.closed')
  async handleClosed(event: TicketClosedEvent): Promise<void> {
    await this.slaQueue.remove(`sla-breach-${event.ticketId}`).catch(() => {});
    this.logger.debug(`Ticket ${event.ticketId} clôturé — job SLA breach annulé`);
  }

  private calculateDelay(dueAt: string): number {
    const due = new Date(dueAt).getTime();
    const now = Date.now();
    return Math.max(0, due - now);
  }
}
