import { Injectable, Logger, Inject } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Queue } from 'bullmq';
import { ASSIGNMENT_QUEUE } from '../../../queues/queues.module';
import { TicketCreatedEvent } from '../domain/ticket.events';

interface BullMqQueues {
  assignment: Queue;
  [key: string]: Queue;
}

/**
 * Listener d'assignation automatique pour les événements de domaine Ticket.
 * Publie des requêtes de routage de ticket dans la file BullMQ assignment-queue.
 */
@Injectable()
export class TicketAssignmentListener {
  private readonly logger = new Logger(TicketAssignmentListener.name);

  constructor(@Inject('BullMQ_Queues') private readonly queues: BullMqQueues) {}

  private get assignmentQueue(): Queue {
    return this.queues[ASSIGNMENT_QUEUE] ?? this.queues['assignment'];
  }

  @OnEvent('ticket.created')
  async handleTicketCreated(event: TicketCreatedEvent): Promise<void> {
    const ticketId = event.ticket['id'] as string;
    const ticketNumber = event.ticket['ticketNumber'] as string;

    try {
      await this.assignmentQueue.add(
        'route_ticket',
        { ticketId, action: 'route_ticket' },
        { jobId: `route-ticket-${ticketId}`, removeOnComplete: true, removeOnFail: true },
      );
      this.logger.debug(`Requete d'assignation automatique planifiee pour le ticket ${ticketNumber}`);
    } catch (err) {
      this.logger.warn(
        `File d'assignation BullMQ indisponible. Routage asynchrone non planifie pour ${ticketNumber}: ${String(err)}`,
      );
    }
  }

  @OnEvent('ticket.unassigned')
  async handleTicketUnassigned(event: { ticketId: string; ticketNumber: string }): Promise<void> {
    try {
      await this.assignmentQueue.add(
        'route_ticket',
        { ticketId: event.ticketId, action: 'route_ticket' },
        { jobId: `route-ticket-${event.ticketId}`, removeOnComplete: true, removeOnFail: true },
      );
      this.logger.debug(`Requete de re-aiguillage automatique planifiee pour le ticket ${event.ticketNumber}`);
    } catch (err) {
      this.logger.warn(
        `File d'assignation BullMQ indisponible. Re-aiguillage non planifie pour ${event.ticketNumber}: ${String(err)}`,
      );
    }
  }
}
