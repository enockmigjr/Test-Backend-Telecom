/**
 * ============================================================================
 * FICHIER : src/modules/tickets/listeners/ticket-sla.listener.ts
 * RÔLE : Écouteur d'événements pour la planification et l'annulation des contrôles de retards SLA.
 * EXPLICATION :
 * Ce composant réagit de manière asynchrone aux événements métiers sur les tickets :
 * 1. `ticket.created` : Planifie un job différé (`check_breach`) dans la file BullMQ `SLA_QUEUE` calculé jusqu'à l'échéance `resolutionDueAt`.
 * 2. `ticket.resolved` & `ticket.closed` : Annule immédiatement le job de vérification SLA en attente (`remove('sla-breach-{ticketId}')`).
 * ============================================================================
 */

import { Injectable, Logger, Inject } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Queue } from 'bullmq';
import { TicketCreatedEvent, TicketResolvedEvent, TicketClosedEvent } from '../domain/ticket.events';
import { BullMqQueues } from '../../../queues/queues.types';

/**
 * Listener SLA pour les événements de domaine Ticket.
 */
@Injectable()
export class TicketSlaListener {
  private readonly logger = new Logger(TicketSlaListener.name);

  constructor(@Inject('BullMQ_Queues') private readonly queues: BullMqQueues) {}

  private get slaQueue(): Queue {
    return this.queues.sla;
  }

  /**
   * Planifie un job de vérification de dépassement SLA différé lors de la création d'un ticket.
   */
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

  /**
   * Annule le job de contrôle SLA si le ticket est résolu avant son échéance.
   */
  @OnEvent('ticket.resolved')
  async handleResolved(event: TicketResolvedEvent): Promise<void> {
    await this.slaQueue.remove(`sla-breach-${event.ticketId}`).catch(() => {});
    this.logger.debug(`Ticket ${event.ticketId} résolu — job SLA breach annulé`);
  }

  /**
   * Annule le job de contrôle SLA lors de la clôture définitive du ticket.
   */
  @OnEvent('ticket.closed')
  async handleClosed(event: TicketClosedEvent): Promise<void> {
    await this.slaQueue.remove(`sla-breach-${event.ticketId}`).catch(() => {});
    this.logger.debug(`Ticket ${event.ticketId} clôturé — job SLA breach annulé`);
  }

  /**
   * Calcule le délai d'attente en millisecondes jusqu'à l'échéance contractuelle.
   */
  private calculateDelay(dueAt: string): number {
    const due = new Date(dueAt).getTime();
    const now = Date.now();
    return Math.max(0, due - now);
  }
}
