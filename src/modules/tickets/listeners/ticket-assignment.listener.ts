/**
 * ============================================================================
 * FICHIER : src/modules/tickets/listeners/ticket-assignment.listener.ts
 * RÔLE : Écouteur d'événements pour le déclenchement asynchrone du routage automatique des tickets.
 * EXPLICATION :
 * Ce composant écoute la création et le désengagement d'incidents pour solliciter le moteur d'assignation :
 * 1. `ticket.created` & `ticket.unassigned` : Enfile une demande de job `route_ticket` dans la file BullMQ `ASSIGNMENT_QUEUE`.
 * 2. Travail asynchrone dédoublonné : Utilise `jobId: route-ticket-{ticketId}` pour prévenir les requêtes de routage simultanées.
 * ============================================================================
 */

import { Injectable, Logger, Inject } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Queue } from 'bullmq';
import { TicketCreatedEvent } from '../domain/ticket.events';
import { BullMqQueues } from '../../../queues/queues.types';

/**
 * Listener d'assignation automatique pour les événements de domaine Ticket.
 */
@Injectable()
export class TicketAssignmentListener {
  private readonly logger = new Logger(TicketAssignmentListener.name);

  constructor(@Inject('BullMQ_Queues') private readonly queues: BullMqQueues) {}

  private get assignmentQueue(): Queue {
    return this.queues.assignment;
  }

  /**
   * Déclenche la demande de routage automatique lors de la création d'un nouveau ticket.
   */
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
      this.logger.debug(`Requête d'assignation automatique planifiée pour le ticket ${ticketNumber}`);
    } catch (err) {
      this.logger.warn(
        `File d'assignation BullMQ indisponible. Routage asynchrone non planifié pour ${ticketNumber}: ${String(err)}`,
      );
    }
  }

  /**
   * Déclenche une demande de ré-aiguillage automatique lorsque l'assignation d'un ticket est annulée.
   */
  @OnEvent('ticket.unassigned')
  async handleTicketUnassigned(event: { ticketId: string; ticketNumber: string }): Promise<void> {
    try {
      await this.assignmentQueue.add(
        'route_ticket',
        { ticketId: event.ticketId, action: 'route_ticket' },
        { jobId: `route-ticket-${event.ticketId}`, removeOnComplete: true, removeOnFail: true },
      );
      this.logger.debug(`Requête de ré-aiguillage automatique planifiée pour le ticket ${event.ticketNumber}`);
    } catch (err) {
      this.logger.warn(
        `File d'assignation BullMQ indisponible. Ré-aiguillage non planifié pour ${event.ticketNumber}: ${String(err)}`,
      );
    }
  }
}
