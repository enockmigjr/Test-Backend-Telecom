import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Queue } from 'bullmq';
import { redisConfig } from '../../../common/providers/redis.config';
import { EMAIL_QUEUE, NOTIFICATION_QUEUE } from '../../../queues/queues.module';
import { TicketCreatedEvent, TicketAssignedEvent, TicketEscalatedEvent, TicketResolvedEvent } from '../domain/ticket.events';
import { DrizzleProvider } from '../../../database/drizzle.provider';
import { users, departments } from '../../../database/schemas';
import { eq } from 'drizzle-orm';

@Injectable()
export class TicketNotificationListener {
  private readonly logger = new Logger(TicketNotificationListener.name);
  private emailQueue: Queue;
  private notificationQueue: Queue;

  constructor(private readonly drizzle: DrizzleProvider) {
    const conn = { host: redisConfig.host, port: redisConfig.port, password: redisConfig.password || undefined };
    this.emailQueue = new Queue(EMAIL_QUEUE, { connection: conn });
    this.notificationQueue = new Queue(NOTIFICATION_QUEUE, { connection: conn });
  }

  @OnEvent('ticket.created')
  async handleTicketCreated(event: TicketCreatedEvent): Promise<void> {
    this.logger.log(`Notification: ticket créé ${event.ticket['ticketNumber'] || event.ticket['id']}`);
    // Job email de confirmation
    await this.emailQueue.add('send-email', {
      to: 'creator@telecom.local',
      subject: `Ticket créé — ${event.ticket['ticketNumber'] || ''}`,
      template: 'ticketCreated',
      data: { ticketNumber: event.ticket['ticketNumber'] || '', title: event.ticket['title'] || '', priority: event.ticket['priority'] || '' },
    });
  }

  @OnEvent('ticket.assigned')
  async handleTicketAssigned(event: TicketAssignedEvent): Promise<void> {
    this.logger.log(`Notification: ticket ${event.ticketId} assigné à ${event.assignedTo}`);
    await this.notificationQueue.add('create-notification', {
      userId: event.assignedTo,
      type: 'TICKET_ASSIGNED',
      title: 'Nouveau ticket assigné',
      message: `Le ticket ${event.ticketId} vous a été assigné.`,
      referenceType: 'ticket',
      referenceId: event.ticketId,
    });
  }

  @OnEvent('ticket.escalated')
  async handleTicketEscalated(event: TicketEscalatedEvent): Promise<void> {
    this.logger.log(`Notification: ticket ${event.ticketId} escaladé à ${event.escalatedTo}`);
    await this.notificationQueue.add('create-notification', {
      userId: event.escalatedTo,
      type: 'TICKET_ESCALATED',
      title: 'Ticket escaladé',
      message: `Le ticket ${event.ticketId} a été escaladé vers vous.`,
      referenceType: 'ticket',
      referenceId: event.ticketId,
    });
  }

  @OnEvent('ticket.resolved')
  async handleTicketResolved(event: TicketResolvedEvent): Promise<void> {
    this.logger.log(`Notification: ticket ${event.ticketId} résolu`);
    await this.emailQueue.add('send-email', {
      to: 'resolver@telecom.local',
      subject: `Ticket résolu — ${event.ticketId}`,
      template: 'ticketResolved',
      data: { ticketNumber: event.ticketId },
    });
  }
}
