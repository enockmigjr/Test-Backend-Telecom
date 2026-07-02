import { Injectable, Logger, Inject } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { and, lt, gte, eq, notInArray, isNull } from 'drizzle-orm';
import { Queue } from 'bullmq';
import { DrizzleProvider } from '../../database/drizzle.provider';
import { tickets, users, ticketHistory } from '../../database/schemas';
import { MetricsService } from '../../common/metrics/metrics.service';
import { TelecomWebSocketGateway } from '../../websocket/websocket.gateway';
import { EMAIL_QUEUE, NOTIFICATION_QUEUE } from '../../queues/queues.module';
import { generateUuid } from '../../common/helpers/uuidv7.helper';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TicketStatusChangedEvent, TicketClosedEvent } from '../tickets/domain/ticket.events';

interface BullMqQueues {
  email: Queue;
  notification: Queue;
  [key: string]: Queue;
}

/**
 * Moteur de verification des SLA et auto-cloture.
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
    private readonly eventEmitter: EventEmitter2,
    @Inject('BullMQ_Queues') private readonly queues: BullMqQueues,
  ) {}

  private get emailQueue(): Queue {
    return this.queues[EMAIL_QUEUE] ?? this.queues['email'];
  }

  private get notificationQueue(): Queue {
    return this.queues[NOTIFICATION_QUEUE] ?? this.queues['notification'];
  }

  /**
   * Cron toutes les 5 minutes — SLA + Auto-cloture.
   */
  @Cron('*/5 * * * *')
  async checkSla(): Promise<void> {
    this.logger.debug('Verification periodique des SLA et auto-cloture...');
    await this.processSlaBreachesAndWarnings();
    await this.processAutoCloseResolvedTickets();
  }

  /**
   * Detecte les breaches et warnings SLA.
   */
  private async processSlaBreachesAndWarnings(): Promise<void> {
    const now = new Date();
    const warningThreshold = new Date(now.getTime() + 30 * 60 * 1000); // 30 minutes

    // ─── Phase 1 : Breach (echeance depassee) ────────────────
    const breachedTickets = await this.drizzle.db
      .select({
        id: tickets.id,
        ticketNumber: tickets.ticketNumber,
        title: tickets.title,
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
      this.logger.warn(`SLA Breach detecte: ${ticket.ticketNumber} (priorite: ${ticket.priority})`);

      await this.drizzle.db.update(tickets).set({ slaBreached: true }).where(eq(tickets.id, ticket.id));
      this.metricsService.slaBreachesTotal.inc({ priority: ticket.priority });

      const payload = {
        ticketId: ticket.id,
        ticketNumber: ticket.ticketNumber,
        priority: ticket.priority,
        resolutionDueAt: ticket.resolutionDueAt,
      };

      this.wsGateway.emitToRole('SUPERVISOR', 'ticket.sla_breached', payload);

      if (ticket.assignedTo) {
        this.wsGateway.emitToUser(ticket.assignedTo, 'ticket.sla_breached', payload);

        await this.notificationQueue.add('create-notification', {
          userId: ticket.assignedTo,
          type: 'SLA_BREACHED',
          title: `⚠️ SLA Depasse — ${ticket.ticketNumber}`,
          message: `Le SLA du ticket ${ticket.ticketNumber} a ete depasse. Action urgente requise.`,
          referenceType: 'ticket',
          referenceId: ticket.id,
        });

        if (ticket.assigneeEmail) {
          await this.emailQueue.add('send-email', {
            to: ticket.assigneeEmail,
            subject: `🔴 SLA Depasse — ${ticket.ticketNumber}`,
            template: 'slaBreach',
            data: {
              ticketNumber: ticket.ticketNumber,
              title: ticket.title,
              priority: ticket.priority,
              dueDate: ticket.resolutionDueAt?.toISOString() ?? 'N/A',
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
      this.logger.warn(`SLA Warning: ${ticket.ticketNumber} — echeance imminente (< 30 min)`);

      const warningPayload = {
        ticketId: ticket.id,
        ticketNumber: ticket.ticketNumber,
        priority: ticket.priority,
        resolutionDueAt: ticket.resolutionDueAt,
        minutesRemaining: ticket.resolutionDueAt
          ? Math.round((ticket.resolutionDueAt.getTime() - now.getTime()) / 60000)
          : 0,
      };

      if (ticket.assignedTo) {
        this.wsGateway.emitToUser(ticket.assignedTo, 'ticket.sla_warning', warningPayload);

        await this.notificationQueue.add('create-notification', {
          userId: ticket.assignedTo,
          type: 'SLA_WARNING',
          title: `⏰ SLA Warning — ${ticket.ticketNumber}`,
          message: `Moins de 30 minutes avant l'echeance SLA du ticket ${ticket.ticketNumber}.`,
          referenceType: 'ticket',
          referenceId: ticket.id,
        });
      }

      this.wsGateway.emitToRole('SUPERVISOR', 'ticket.sla_warning', warningPayload);
    }
  }

  /**
   * Cloture automatiquement les tickets en RESOLVED depuis plus de 48 heures.
   */
  private async processAutoCloseResolvedTickets(): Promise<void> {
    const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);

    // Trouver les tickets resolus depuis plus de 48h
    const resolvedTickets = await this.drizzle.db
      .select({
        id: tickets.id,
        ticketNumber: tickets.ticketNumber,
        status: tickets.status,
        assignedTo: tickets.assignedTo,
      })
      .from(tickets)
      .where(and(eq(tickets.status, 'RESOLVED'), lt(tickets.resolvedAt, fortyEightHoursAgo), isNull(tickets.deletedAt)))
      .limit(100);

    if (resolvedTickets.length === 0) return;

    // Trouver l'utilisateur admin systeme par defaut pour lui attribuer l'action d'historique
    const [adminUser] = await this.drizzle.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, 'admin@telecom.local'))
      .limit(1);

    const systemUserId = adminUser?.id;
    if (!systemUserId) {
      this.logger.error("Impossible de proceder a l'auto-cloture : administrateur systeme introuvable.");
      return;
    }

    for (const ticket of resolvedTickets) {
      this.logger.log(`Auto-cloture du ticket ${ticket.ticketNumber} (RESOLVED depuis plus de 48h)`);

      // Mettre a jour en base
      await this.drizzle.db
        .update(tickets)
        .set({ status: 'CLOSED', closedAt: new Date() })
        .where(eq(tickets.id, ticket.id));

      // Enregistrer l'historique
      await this.drizzle.db.insert(ticketHistory).values({
        id: generateUuid(),
        ticketId: ticket.id,
        userId: systemUserId,
        action: 'STATUS_CHANGED',
        oldValue: { status: 'RESOLVED' },
        newValue: { status: 'CLOSED' },
        metadata: { reason: 'Cloture automatique par le systeme apres 48 heures de resolution sans activite.' },
      });

      // Emettre les evenements NestJS pour les listeners (notifications, etc)
      this.eventEmitter.emit(
        'ticket.status_changed',
        new TicketStatusChangedEvent(ticket.id, 'RESOLVED', 'CLOSED', systemUserId),
      );
      this.eventEmitter.emit('ticket.closed', new TicketClosedEvent(ticket.id, systemUserId));

      // Mettre a jour les metriques Prometheus
      this.metricsService.ticketsActive.dec();
    }
  }

  calculateDueDate(createdAt: Date, resolutionMinutes: number): Date {
    return new Date(createdAt.getTime() + resolutionMinutes * 60 * 1000);
  }
}
