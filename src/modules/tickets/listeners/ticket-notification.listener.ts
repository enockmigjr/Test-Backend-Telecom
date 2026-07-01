import { Injectable, Logger, Inject } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Queue } from 'bullmq';
import { eq, and, isNull } from 'drizzle-orm';
import { EMAIL_QUEUE, NOTIFICATION_QUEUE } from '../../../queues/queues.module';
import {
  TicketCreatedEvent,
  TicketAssignedEvent,
  TicketEscalatedEvent,
  TicketResolvedEvent,
  TicketStatusChangedEvent,
} from '../domain/ticket.events';
import { DrizzleProvider } from '../../../database/drizzle.provider';
import { users } from '../../../database/schemas';
import { TelecomWebSocketGateway } from '../../../websocket/websocket.gateway';

interface BullMqQueues {
  email: Queue;
  notification: Queue;
  [key: string]: Queue;
}

/**
 * Listener de notifications pour les événements de domaine Ticket.
 *
 * Stratégie de notification :
 * 1. WebSocket → temps réel si l'utilisateur est connecté
 * 2. NOTIFICATION_QUEUE → persistance en DB (lue au prochain login si offline)
 * 3. EMAIL_QUEUE → email asynchrone pour les événements critiques
 *
 * NOTE : Injecte BullMQ_Queues (connexions partagées) et TelecomWebSocketGateway.
 * Les emails référencent les vrais emails des utilisateurs (lookup DB).
 */
@Injectable()
export class TicketNotificationListener {
  private readonly logger = new Logger(TicketNotificationListener.name);

  constructor(
    @Inject('BullMQ_Queues') private readonly queues: BullMqQueues,
    private readonly drizzle: DrizzleProvider,
    private readonly wsGateway: TelecomWebSocketGateway,
  ) {}

  private get emailQueue(): Queue {
    return this.queues[EMAIL_QUEUE] ?? this.queues['email'];
  }

  private get notificationQueue(): Queue {
    return this.queues[NOTIFICATION_QUEUE] ?? this.queues['notification'];
  }

  /** Récupère l'email d'un utilisateur depuis la DB */
  private async getUserEmail(userId: string): Promise<string | null> {
    const [user] = await this.drizzle.db
      .select({ email: users.email })
      .from(users)
      .where(and(eq(users.id, userId), isNull(users.deletedAt)))
      .limit(1);
    return user?.email ?? null;
  }

  @OnEvent('ticket.created')
  async handleTicketCreated(event: TicketCreatedEvent): Promise<void> {
    const ticketNumber = event.ticket['ticketNumber'] as string;
    const title = event.ticket['title'] as string;
    const priority = event.ticket['priority'] as string;
    const departmentId = event.ticket['departmentId'] as string;
    const creatorId = event.userId;

    this.logger.log(`Notification: ticket créé ${ticketNumber}`);

    // Émettre en temps réel au département propriétaire
    this.wsGateway.emitToDepartment(departmentId, 'ticket.created', {
      ticketId: event.ticket['id'],
      ticketNumber,
      title,
      priority,
      createdBy: creatorId,
    });

    // Émettre aussi aux superviseurs (accès global)
    this.wsGateway.emitToRole('SUPERVISOR', 'ticket.created', {
      ticketId: event.ticket['id'],
      ticketNumber,
      title,
      priority,
    });

    // Email de confirmation au créateur
    const creatorEmail = await this.getUserEmail(creatorId);
    if (creatorEmail) {
      await this.emailQueue.add('send-email', {
        to: creatorEmail,
        subject: `✅ Ticket créé — ${ticketNumber}`,
        template: 'ticketCreated',
        data: { ticketNumber, title, priority },
      });
    }
  }

  @OnEvent('ticket.assigned')
  async handleTicketAssigned(event: TicketAssignedEvent): Promise<void> {
    this.logger.log(`Notification: ticket ${event.ticketId} assigné à ${event.assignedTo}`);

    // WebSocket → utilisateur assigné
    this.wsGateway.emitToUser(event.assignedTo, 'ticket.assigned', {
      ticketId: event.ticketId,
      assignedBy: event.assignedBy,
    });

    // Persistance en DB via notification-queue (visible même si offline)
    await this.notificationQueue.add('create-notification', {
      userId: event.assignedTo,
      type: 'TICKET_ASSIGNED',
      title: 'Nouveau ticket assigné',
      message: `Le ticket a été assigné vers vous.`,
      referenceType: 'ticket',
      referenceId: event.ticketId,
    });

    // Email à l'assigné
    const assigneeEmail = await this.getUserEmail(event.assignedTo);
    if (assigneeEmail) {
      await this.emailQueue.add('send-email', {
        to: assigneeEmail,
        subject: `📋 Ticket assigné — ID: ${event.ticketId}`,
        template: 'ticketAssigned',
        data: { ticketId: event.ticketId, assignedBy: event.assignedBy },
      });
    }
  }

  @OnEvent('ticket.escalated')
  async handleTicketEscalated(event: TicketEscalatedEvent): Promise<void> {
    this.logger.log(`Notification: ticket ${event.ticketId} escaladé à ${event.escalatedTo}`);

    // WebSocket → utilisateur cible
    this.wsGateway.emitToUser(event.escalatedTo, 'ticket.escalated', {
      ticketId: event.ticketId,
      escalatedBy: event.escalatedBy,
    });

    // WebSocket → tous les superviseurs
    this.wsGateway.emitToRole('SUPERVISOR', 'ticket.escalated', {
      ticketId: event.ticketId,
      escalatedTo: event.escalatedTo,
      escalatedBy: event.escalatedBy,
    });

    // Persistance notification
    await this.notificationQueue.add('create-notification', {
      userId: event.escalatedTo,
      type: 'TICKET_ESCALATED',
      title: 'Ticket escaladé',
      message: `Le ticket a été escaladé vers vous.`,
      referenceType: 'ticket',
      referenceId: event.ticketId,
    });

    // Email
    const escalatedToEmail = await this.getUserEmail(event.escalatedTo);
    if (escalatedToEmail) {
      await this.emailQueue.add('send-email', {
        to: escalatedToEmail,
        subject: `⚠️ Ticket escaladé — ID: ${event.ticketId}`,
        template: 'ticketAssigned',
        data: { ticketId: event.ticketId, assignedBy: event.escalatedBy },
      });
    }
  }

  @OnEvent('ticket.resolved')
  async handleTicketResolved(event: TicketResolvedEvent): Promise<void> {
    this.logger.log(`Notification: ticket ${event.ticketId} résolu`);

    // Notification WebSocket
    this.wsGateway.emitToUser(event.resolvedBy, 'ticket.resolved', {
      ticketId: event.ticketId,
    });

    // Notification aux superviseurs
    this.wsGateway.emitToRole('SUPERVISOR', 'ticket.resolved', {
      ticketId: event.ticketId,
      resolvedBy: event.resolvedBy,
    });

    // Persistance
    await this.notificationQueue.add('create-notification', {
      userId: event.resolvedBy,
      type: 'TICKET_RESOLVED',
      title: 'Ticket résolu',
      message: `Le ticket a été résolu avec succès.`,
      referenceType: 'ticket',
      referenceId: event.ticketId,
    });
  }

  @OnEvent('ticket.status_changed')
  async handleStatusChanged(event: TicketStatusChangedEvent): Promise<void> {
    // Notifier via WS les superviseurs de tout changement de statut
    this.wsGateway.emitToRole('SUPERVISOR', 'ticket.status_changed', {
      ticketId: event.ticketId,
      oldStatus: event.oldStatus,
      newStatus: event.newStatus,
    });
  }
}
