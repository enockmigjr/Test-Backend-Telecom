/**
 * ============================================================================
 * FICHIER : src/modules/sla/sla-alert-notifier.service.ts
 * RÔLE : Service de diffusion multi-canal des alertes et dépassements de contrats SLA.
 * EXPLICATION :
 * Ce service propage les événements d'urgence SLA à travers l'ensemble des canaux de communication :
 * 1. WebSockets temps réel : Émet les événements `ticket.sla_warning` et `ticket.sla_breached` vers les salons du département (`emitToDepartment`) et de l'agent assigné (`emitToUser`).
 * 2. Notifications In-App : Enfile des jobs BullMQ à la file `NOTIFICATION_QUEUE` avec dédoublonnement par `jobId`.
 * 3. Emails d'urgence : Enfile des emails Handlebars (`slaWarning` ou `slaBreach`) dans `EMAIL_QUEUE`.
 * 4. Métriques Prometheus : Incrémente le compteur `slaBreachesTotal` par priorité et cible SLA (`FIRST_RESPONSE` ou `RESOLUTION`).
 * ============================================================================
 */

import { Inject, Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { MetricsService } from '../../common/metrics/metrics.service';
import { BullMqQueues } from '../../queues/queues.types';
import { TelecomWebSocketGateway } from '../../websocket/websocket.gateway';
import { SlaAlertTicket, SlaTarget } from './sla-alert.types';

/**
 * Service orchestrant l'envoi d'alertes préventives et de notifications de dépassement SLA.
 */
@Injectable()
export class SlaAlertNotifierService {
  constructor(
    private readonly metricsService: MetricsService,
    private readonly wsGateway: TelecomWebSocketGateway,
    @Inject('BullMQ_Queues') private readonly queues: BullMqQueues,
  ) {}

  /**
   * Diffuse un avertissement de SLA imminent (ex: moins de 30 minutes avant l'échéance).
   *
   * @param ticket Ticket à risque.
   * @param target Cible du contrat SLA (première réponse ou résolution).
   * @param now Horodatage courant du contrôle.
   */
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
        message: `${minutesRemaining} minute(s) avant l'échéance ${this.targetLabel(target)} du ticket.`,
        referenceType: 'ticket',
        referenceId: ticket.id,
        emitWs: false, // l'événement ticket.sla_warning est déjà émis en direct
      },
      { jobId: this.jobId(ticket.id, target, 'warning-notification') },
    );
    await this.enqueueEmail(ticket, target, 'slaWarning', `SLA proche - ${ticket.ticketNumber}`, {
      slaDueAt: this.formatDateTime(ticket.dueAt),
      remainingMinutes: minutesRemaining,
    });
  }

  /**
   * Diffuse la notification de pénalité ou de dépassement avéré de SLA.
   *
   * @param ticket Ticket ayant dépassé son délai contractuel.
   * @param target Cible SLA violée (FIRST_RESPONSE ou RESOLUTION).
   * @param now Date de constatation du retard.
   */
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
        title: `SLA ${this.targetLabel(target)} dépassé - ${ticket.ticketNumber}`,
        message: `L'échéance ${this.targetLabel(target)} du ticket a été dépassée.`,
        referenceType: 'ticket',
        referenceId: ticket.id,
        emitWs: false, // l'événement ticket.sla_breached est déjà émis en direct
      },
      { jobId: this.jobId(ticket.id, target, 'breach-notification') },
    );
    await this.enqueueEmail(ticket, target, 'slaBreach', `SLA dépassé - ${ticket.ticketNumber}`, {
      slaExpiredAt: this.formatDateTime(ticket.dueAt),
      overdueBy: this.formatDuration(overdueMinutes),
    });
    this.metricsService.slaBreachesTotal.inc({ priority: ticket.priority, target });
  }

  /**
   * Construit l'objet payload transmis aux clients WebSocket.
   */
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

  /**
   * Enfile une demande d'envoi d'email d'avertissement ou de dépassement SLA dans BullMQ.
   */
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
          department: ticket.departmentName ?? 'Non renseigné',
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

  /**
   * Libellé lisible de la cible SLA.
   */
  private targetLabel(target: SlaTarget): string {
    return target === 'FIRST_RESPONSE' ? 'de première réponse' : 'de résolution';
  }

  /**
   * Formatage lisible de date et heure.
   */
  private formatDateTime(value: Date): string {
    return value.toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  /**
   * Formatage lisible de durée en minutes ou heures.
   */
  private formatDuration(minutes: number): string {
    return minutes >= 60 ? `${Math.floor(minutes / 60)}h${minutes % 60}min` : `${minutes} min`;
  }

  /**
   * Clé unique d'identifiant de Job BullMQ pour éviter les envois d'alertes en doublon.
   */
  private jobId(ticketId: string, target: SlaTarget, kind: string): string {
    return `sla-${ticketId}-${target.toLowerCase().replace('_', '-')}-${kind}`;
  }

  private get emailQueue(): Queue {
    return this.queues.email;
  }

  private get notificationQueue(): Queue {
    return this.queues.notification;
  }
}
