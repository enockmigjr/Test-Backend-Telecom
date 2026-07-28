import { Inject, Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { MetricsService } from '../../common/metrics/metrics.service';
import { EMAIL_QUEUE, NOTIFICATION_QUEUE } from '../../queues/queues.module';
import { BullMqQueues } from '../../queues/queues.types';
import { TelecomWebSocketGateway } from '../../websocket/websocket.gateway';
import { SlaAlertTicket, SlaTarget } from './sla-alert.types';

@Injectable()
export class SlaAlertNotifierService {
  constructor(
    private readonly metricsService: MetricsService,
    private readonly wsGateway: TelecomWebSocketGateway,
    @Inject('BullMQ_Queues') private readonly queues: BullMqQueues,
  ) {}

  async notifyWarning(ticket: SlaAlertTicket, target: SlaTarget, now: Date): Promise<void> {
    const minutesRemaining = Math.max(0, Math.round((ticket.dueAt.getTime() - now.getTime()) / 60000));
    const payload = this.buildPayload(ticket, target, { minutesRemaining });

    this.wsGateway.emitToDepartment(ticket.departmentId, 'ticket.sla_warning', payload);
    if (!ticket.assignedTo) return;

    this.wsGateway.emitToUser(ticket.assignedTo, 'ticket.sla_warning', payload);
    await this.notificationQueue.add(
      'create-notification',
      {
        userId: ticket.assignedTo,
        type: 'SLA_WARNING',
        title: `SLA ${this.targetLabel(target)} proche - ${ticket.ticketNumber}`,
        message: `${minutesRemaining} minute(s) avant l'echeance ${this.targetLabel(target)} du ticket.`,
        referenceType: 'ticket',
        referenceId: ticket.id,
      },
      { jobId: this.jobId(ticket.id, target, 'warning-notification') },
    );
    await this.enqueueEmail(ticket, target, 'slaWarning', `SLA proche - ${ticket.ticketNumber}`, {
      slaDueAt: this.formatDateTime(ticket.dueAt),
      remainingMinutes: minutesRemaining,
    });
  }

  async notifyBreach(ticket: SlaAlertTicket, target: SlaTarget, now: Date): Promise<void> {
    const overdueMinutes = Math.max(0, Math.round((now.getTime() - ticket.dueAt.getTime()) / 60000));
    const payload = this.buildPayload(ticket, target, { overdueMinutes });

    this.wsGateway.emitToDepartment(ticket.departmentId, 'ticket.sla_breached', payload);
    if (!ticket.assignedTo) {
      this.metricsService.slaBreachesTotal.inc({ priority: ticket.priority, target });
      return;
    }

    this.wsGateway.emitToUser(ticket.assignedTo, 'ticket.sla_breached', payload);
    await this.notificationQueue.add(
      'create-notification',
      {
        userId: ticket.assignedTo,
        type: 'SLA_BREACHED',
        title: `SLA ${this.targetLabel(target)} depasse - ${ticket.ticketNumber}`,
        message: `L'echeance ${this.targetLabel(target)} du ticket a ete depassee.`,
        referenceType: 'ticket',
        referenceId: ticket.id,
      },
      { jobId: this.jobId(ticket.id, target, 'breach-notification') },
    );
    await this.enqueueEmail(ticket, target, 'slaBreach', `SLA depasse - ${ticket.ticketNumber}`, {
      slaExpiredAt: this.formatDateTime(ticket.dueAt),
      overdueBy: this.formatDuration(overdueMinutes),
    });
    this.metricsService.slaBreachesTotal.inc({ priority: ticket.priority, target });
  }

  private buildPayload(ticket: SlaAlertTicket, target: SlaTarget, details: Record<string, number>) {
    return {
      ticketId: ticket.id,
      ticketNumber: ticket.ticketNumber,
      priority: ticket.priority,
      slaTarget: target,
      dueAt: ticket.dueAt,
      firstResponseDueAt: target === 'FIRST_RESPONSE' ? ticket.dueAt : undefined,
      resolutionDueAt: target === 'RESOLUTION' ? ticket.dueAt : undefined,
      ...details,
    };
  }

  private async enqueueEmail(
    ticket: SlaAlertTicket,
    target: SlaTarget,
    template: 'slaWarning' | 'slaBreach',
    subject: string,
    timing: Record<string, string | number>,
  ): Promise<void> {
    if (!ticket.assigneeEmail) return;
    const assigneeName =
      `${ticket.assigneeFirstName ?? ''} ${ticket.assigneeLastName ?? ''}`.trim() || ticket.assigneeEmail;

    await this.emailQueue.add(
      'send-email',
      {
        to: ticket.assigneeEmail,
        subject,
        template,
        data: {
          recipientName: assigneeName,
          ticketNumber: ticket.ticketNumber,
          ticketTitle: ticket.title,
          priority: ticket.priority,
          status: ticket.status,
          severity: ticket.severity,
          category: ticket.categoryName,
          department: ticket.departmentName ?? 'Non renseigne',
          assigneeName,
          slaTarget: target,
          slaTargetLabel: this.targetLabel(target),
          ticketUrl: `${process.env['APP_URL'] || 'http://localhost:3000'}/tickets/${ticket.id}`,
          ...timing,
        },
      },
      { jobId: this.jobId(ticket.id, target, `${template}-email`) },
    );
  }

  private targetLabel(target: SlaTarget): string {
    return target === 'FIRST_RESPONSE' ? 'de premiere reponse' : 'de resolution';
  }

  private formatDateTime(value: Date): string {
    return value.toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  private formatDuration(minutes: number): string {
    return minutes >= 60 ? `${Math.floor(minutes / 60)}h${minutes % 60}min` : `${minutes} min`;
  }

  private jobId(ticketId: string, target: SlaTarget, kind: string): string {
    return `sla-${ticketId}-${target.toLowerCase().replace('_', '-')}-${kind}`;
  }

  private get emailQueue(): Queue {
    return this.queues[EMAIL_QUEUE] ?? this.queues.email;
  }

  private get notificationQueue(): Queue {
    return this.queues[NOTIFICATION_QUEUE] ?? this.queues.notification;
  }
}
