import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Queue } from 'bullmq';
import { redisConfig } from '../../../common/providers/redis.config';
import { AUDIT_QUEUE } from '../../../queues/queues.module';
import {
  TicketCreatedEvent,
  TicketStatusChangedEvent,
  TicketAssignedEvent,
  TicketClosedEvent,
  TicketReopenedEvent,
} from '../domain/ticket.events';

@Injectable()
export class TicketAuditListener {
  private readonly logger = new Logger(TicketAuditListener.name);
  private auditQueue: Queue;

  constructor() {
    this.auditQueue = new Queue(AUDIT_QUEUE, {
      connection: { host: redisConfig.host, port: redisConfig.port, password: redisConfig.password || undefined },
    });
  }

  @OnEvent('ticket.created')
  async handleCreated(event: TicketCreatedEvent): Promise<void> {
    await this.auditQueue.add('audit-log', {
      userId: event.userId,
      action: 'TICKET_CREATED',
      entityType: 'ticket',
      entityId: event.ticket['id'] as string,
      newValue: { ticketNumber: event.ticket['ticketNumber'], title: event.ticket['title'] },
    });
  }

  @OnEvent('ticket.assigned')
  async handleAssigned(event: TicketAssignedEvent): Promise<void> {
    await this.auditQueue.add('audit-log', {
      userId: event.assignedBy,
      action: 'TICKET_ASSIGNED',
      entityType: 'ticket',
      entityId: event.ticketId,
      newValue: { assignedTo: event.assignedTo },
    });
  }

  @OnEvent('ticket.status_changed')
  async handleStatusChanged(event: TicketStatusChangedEvent): Promise<void> {
    await this.auditQueue.add('audit-log', {
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
    await this.auditQueue.add('audit-log', {
      userId: event.closedBy,
      action: 'TICKET_CLOSED',
      entityType: 'ticket',
      entityId: event.ticketId,
    });
  }

  @OnEvent('ticket.reopened')
  async handleReopened(event: TicketReopenedEvent): Promise<void> {
    await this.auditQueue.add('audit-log', {
      userId: event.reopenedBy,
      action: 'TICKET_REOPENED',
      entityType: 'ticket',
      entityId: event.ticketId,
    });
  }
}
