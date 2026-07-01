import { Injectable, Logger, Inject } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { and, lt, gte, eq, notInArray, isNull } from 'drizzle-orm';
import { Queue } from 'bullmq';
import { DrizzleProvider } from '../../database/drizzle.provider';
import { tickets, users } from '../../database/schemas';
import { MetricsService } from '../../common/metrics/metrics.service';
import { TelecomWebSocketGateway } from '../../websocket/websocket.gateway';
import { EMAIL_QUEUE, NOTIFICATION_QUEUE } from '../../queues/queues.module';

interface BullMqQueues {
  email: Queue;
  notification: Queue;
  [key: string]: Queue;
}

/**
 * Moteur de vérification des SLA.
 * Exécuté toutes les 5 minutes via cron pour détecter les dépassements
 * et avertissements SLA sur les tickets actifs.
 *
 * En cas de breach :
 * - Met à jour slaBreached = true dans la DB
 * - Émet un event WebSocket aux superviseurs et à l'assigné
 * - Envoie un email via la email-queue
 * - Persiste une notification via notification-queue
 *
 * En cas de warning (< 30 min restantes) :
 * - Émet un event WebSocket à l'assigné seulement
 */
@Injectable()
export class SlaEngineService {
  private readonly logger = new Logger(SlaEngineService.name);

  private static readonly CLOSED_STATUSES: Array<typeof tickets.$inferSelect.status> = [
    'RESOLVED',
    'CLOSED',
    'CANCELLED',
  ];

  constructor(
    private readonly drizzle: DrizzleProvider,
    private readonly metricsService: MetricsService,
    private readonly wsGateway: TelecomWebSocketGateway,
    @Inject('BullMQ_Queues') private readonly queues: BullMqQueues,
  ) {}

  private get emailQueue(): Queue {
    return this.queues[EMAIL_QUEUE] ?? this.queues['email'];
  }

  private get notificationQueue(): Queue {
    return this.queues[NOTIFICATION_QUEUE] ?? this.queues['notification'];
  }

  /**
   * Cron toutes les 5 minutes — vérifie les SLA.
   */
  @Cron('*/5 * * * *')
  async checkSla(): Promise<void> {
    this.logger.debug('Vérification périodique des SLA...');

    const now = new Date();
    const warningThreshold = new Date(now.getTime() + 30 * 60 * 1000); // 30 minutes

    // ─── Phase 1 : Breach (échéance dépassée) ────────────────
    const breachedTickets = await this.drizzle.db
      .select({
        id: tickets.id,
        ticketNumber: tickets.ticketNumber,
        priority: tickets.priority,
        assignedTo: tickets.assignedTo,
        resolutionDueAt: tickets.resolutionDueAt,
        assigneeEmail: users.email,
        assigneeFirstName: users.firstName,
      })
      .from(tickets)
      .leftJoin(users, eq(tickets.assignedTo, users.id))
      .where(
        and(
          lt(tickets.resolutionDueAt, now),
          eq(tickets.slaBreached, false),
          isNull(tickets.deletedAt),
          notInArray(tickets.status, SlaEngineService.CLOSED_STATUSES),
        ),
      )
      .limit(100);

    for (const ticket of breachedTickets) {
      this.logger.warn(`SLA Breach détecté: ${ticket.ticketNumber} (priorité: ${ticket.priority})`);

      // 1. Mettre à jour en DB
      await this.drizzle.db.update(tickets).set({ slaBreached: true }).where(eq(tickets.id, ticket.id));

      // 2. Métrique Prometheus
      this.metricsService.slaBreachesTotal.inc({ priority: ticket.priority });

      const payload = {
        ticketId: ticket.id,
        ticketNumber: ticket.ticketNumber,
        priority: ticket.priority,
        resolutionDueAt: ticket.resolutionDueAt,
      };

      // 3. WebSocket → superviseurs
      this.wsGateway.emitToRole('SUPERVISOR', 'ticket.sla_breached', payload);

      // 4. WebSocket → assigné (si connecté)
      if (ticket.assignedTo) {
        this.wsGateway.emitToUser(ticket.assignedTo, 'ticket.sla_breached', payload);

        // 5. Notification persistante pour l'assigné
        await this.notificationQueue.add('create-notification', {
          userId: ticket.assignedTo,
          type: 'SLA_BREACHED',
          title: `⚠️ SLA Dépassé — ${ticket.ticketNumber}`,
          message: `Le SLA du ticket ${ticket.ticketNumber} a été dépassé. Action urgente requise.`,
          referenceType: 'ticket',
          referenceId: ticket.id,
        });

        // 6. Email à l'assigné
        if (ticket.assigneeEmail) {
          await this.emailQueue.add('send-email', {
            to: ticket.assigneeEmail,
            subject: `🔴 SLA Dépassé — ${ticket.ticketNumber}`,
            template: 'slaBreach',
            data: {
              ticketNumber: ticket.ticketNumber,
              title: ticket.ticketNumber,
              dueDate: ticket.resolutionDueAt?.toISOString() ?? 'N/A',
              assigneeName: ticket.assigneeFirstName ?? 'Agent',
            },
          });
        }
      }
    }

    // ─── Phase 2 : Warning (< 30 min restantes) ──────────────
    const warningTickets = await this.drizzle.db
      .select({
        id: tickets.id,
        ticketNumber: tickets.ticketNumber,
        priority: tickets.priority,
        assignedTo: tickets.assignedTo,
        resolutionDueAt: tickets.resolutionDueAt,
      })
      .from(tickets)
      .where(
        and(
          gte(tickets.resolutionDueAt, now),
          lt(tickets.resolutionDueAt, warningThreshold),
          isNull(tickets.deletedAt),
          notInArray(tickets.status, SlaEngineService.CLOSED_STATUSES),
          eq(tickets.slaBreached, false),
        ),
      )
      .limit(100);

    for (const ticket of warningTickets) {
      this.logger.warn(`SLA Warning: ${ticket.ticketNumber} — échéance imminente (< 30 min)`);

      const warningPayload = {
        ticketId: ticket.id,
        ticketNumber: ticket.ticketNumber,
        priority: ticket.priority,
        resolutionDueAt: ticket.resolutionDueAt,
        minutesRemaining: ticket.resolutionDueAt
          ? Math.round((ticket.resolutionDueAt.getTime() - now.getTime()) / 60000)
          : 0,
      };

      // WebSocket → assigné uniquement pour le warning
      if (ticket.assignedTo) {
        this.wsGateway.emitToUser(ticket.assignedTo, 'ticket.sla_warning', warningPayload);

        // Notification persistante
        await this.notificationQueue.add('create-notification', {
          userId: ticket.assignedTo,
          type: 'SLA_WARNING',
          title: `⏰ SLA Warning — ${ticket.ticketNumber}`,
          message: `Moins de 30 minutes avant l'échéance SLA du ticket ${ticket.ticketNumber}.`,
          referenceType: 'ticket',
          referenceId: ticket.id,
        });
      }

      // Superviseurs aussi informés des warnings
      this.wsGateway.emitToRole('SUPERVISOR', 'ticket.sla_warning', warningPayload);
    }

    if (breachedTickets.length > 0 || warningTickets.length > 0) {
      this.logger.log(`SLA check terminé: ${breachedTickets.length} breaches, ${warningTickets.length} warnings`);
    }
  }

  /**
   * Calcule la date d'échéance SLA pour un ticket.
   */
  calculateDueDate(createdAt: Date, resolutionMinutes: number): Date {
    return new Date(createdAt.getTime() + resolutionMinutes * 60 * 1000);
  }
}
