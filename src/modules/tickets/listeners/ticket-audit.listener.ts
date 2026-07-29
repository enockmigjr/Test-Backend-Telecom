/**
 * ============================================================================
 * FICHIER : src/modules/tickets/listeners/ticket-audit.listener.ts
 * RÔLE : Écouteur d'événements pour la transmission asynchrone des traces d'audit dans BullMQ.
 * EXPLICATION :
 * Ce composant réagit aux événements de domaine (`ticket.created`, `ticket.assigned`, `ticket.status_changed`, `ticket.closed`, `ticket.reopened`) :
 * 1. Enfilage résilient (`enqueue`) : Envoie chaque action d'audit à la file `AUDIT_QUEUE` sous forme de job `audit-log`.
 * 2. Non-bloquant : Encapsulé dans un try/catch pour qu'une défaillance Redis n'impacte jamais la réponse HTTP du client.
 * ============================================================================
 */

import { Injectable, Logger, Inject } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Queue } from 'bullmq';
import { AUDIT_QUEUE } from '../../../queues/queues.module';
import {
  TicketCreatedEvent,
  TicketStatusChangedEvent,
  TicketAssignedEvent,
  TicketClosedEvent,
  TicketReopenedEvent,
} from '../domain/ticket.events';

interface BullMqQueues {
  audit: Queue;
  [key: string]: Queue;
}

/**
 * Listener d'audit pour les événements de domaine Ticket.
 * Envoie les entrées d'audit dans la AUDIT_QUEUE via BullMQ.
 * Le AuditWorker les persiste de manière asynchrone dans la table audit_logs.
 *
 * NOTE : On injecte le token global 'BullMQ_Queues' au lieu de créer
 * une nouvelle instance Queue — évite les connexions Redis dupliquées.
 *
 * RESILIENCE : Chaque ajout de job est entouré d'un try/catch afin
 * qu'une indisponibilité Redis ne provoque pas d'erreur 500 sur la requête HTTP
 * d'origine. L'audit est un effet de bord non bloquant.
 */
@Injectable()
export class TicketAuditListener {
  private readonly logger = new Logger(TicketAuditListener.name);

  constructor(@Inject('BullMQ_Queues') private readonly queues: BullMqQueues) {}

  private get auditQueue(): Queue {
    return this.queues[AUDIT_QUEUE] ?? this.queues['audit'];
  }

  /**
   * Enfile un job d'audit de manière résiliente sans interrompre la requête en cas d'échec.
   */
  private async enqueue(jobName: string, data: Record<string, unknown>): Promise<void> {
    try {
      await this.auditQueue.add(jobName, data);
    } catch (err) {
      // L'audit est un effet de bord — ne jamais bloquer la requête principale
      this.logger.warn(`Audit queue unavailable (${String(err)}). Job "${jobName}" dropped.`);
    }
  }

  /**
   * Transmet un journal d'audit lors de la création d'un ticket.
   */
  @OnEvent('ticket.created')
  async handleCreated(event: TicketCreatedEvent): Promise<void> {
    await this.enqueue('audit-log', {
      userId: event.userId,
      action: 'TICKET_CREATED',
      entityType: 'ticket',
      entityId: event.ticket['id'] as string,
      newValue: {
        ticketNumber: event.ticket['ticketNumber'],
        title: event.ticket['title'],
        priority: event.ticket['priority'],
      },
    });
  }

  /**
   * Transmet un journal d'audit lors de l'assignation d'un ticket.
   */
  @OnEvent('ticket.assigned')
  async handleAssigned(event: TicketAssignedEvent): Promise<void> {
    await this.enqueue('audit-log', {
      userId: event.assignedBy,
      action: 'TICKET_ASSIGNED',
      entityType: 'ticket',
      entityId: event.ticketId,
      newValue: { assignedTo: event.assignedTo },
    });
  }

  /**
   * Transmet un journal d'audit lors du changement de statut d'un ticket.
   */
  @OnEvent('ticket.status_changed')
  async handleStatusChanged(event: TicketStatusChangedEvent): Promise<void> {
    await this.enqueue('audit-log', {
      userId: event.userId,
      action: 'STATUS_CHANGED',
      entityType: 'ticket',
      entityId: event.ticketId,
      oldValue: { status: event.oldStatus },
      newValue: { status: event.newStatus },
    });
  }

  /**
   * Transmet un journal d'audit lors de la clôture d'un ticket.
   */
  @OnEvent('ticket.closed')
  async handleClosed(event: TicketClosedEvent): Promise<void> {
    await this.enqueue('audit-log', {
      userId: event.closedBy,
      action: 'TICKET_CLOSED',
      entityType: 'ticket',
      entityId: event.ticketId,
    });
  }

  /**
   * Transmet un journal d'audit lors de la réouverture d'un ticket.
   */
  @OnEvent('ticket.reopened')
  async handleReopened(event: TicketReopenedEvent): Promise<void> {
    await this.enqueue('audit-log', {
      userId: event.reopenedBy,
      action: 'TICKET_REOPENED',
      entityType: 'ticket',
      entityId: event.ticketId,
    });
  }
}
