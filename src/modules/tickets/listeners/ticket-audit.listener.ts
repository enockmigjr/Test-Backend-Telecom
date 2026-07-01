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

  private async enqueue(jobName: string, data: Record<string, unknown>): Promise<void> {
    try {
      await this.auditQueue.add(jobName, data);
    } catch (err) {
      // L'audit est un effet de bord — ne jamais bloquer la requête principale
      this.logger.warn(`Audit queue unavailable (${String(err)}). Job "${jobName}" dropped.`);
    }
  }

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

  @OnEvent('ticket.closed')
  async handleClosed(event: TicketClosedEvent): Promise<void> {
    await this.enqueue('audit-log', {
      userId: event.closedBy,
      action: 'TICKET_CLOSED',
      entityType: 'ticket',
      entityId: event.ticketId,
    });
  }

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
