import { Injectable, Logger, OnModuleInit, OnModuleDestroy, Inject } from '@nestjs/common';
import { Worker, Job, Queue } from 'bullmq';
import { eq, and, isNull, gte, lte, count, sql } from 'drizzle-orm';
import { redisConfig } from '../../common/providers/redis.config';
import { REPORT_QUEUE } from '../queues.module';
import { DrizzleProvider } from '../../database/drizzle.provider';
import { tickets, users } from '../../database/schemas';

interface BullMqQueues {
  email: Queue;
  notification: Queue;
  [key: string]: Queue;
}

/**
 * Worker pour la génération asynchrone de rapports (PDF, exports CSV).
 *
 * Flux complet :
 * 1. Le contrôleur enqueue un job dans REPORT_QUEUE → réponse HTTP 202
 * 2. Ce worker consomme le job, génère les données du rapport
 * 3. Une notification in-app est créée pour informer l'utilisateur
 * 4. Un email est envoyé au demandeur avec le résumé
 */
@Injectable()
export class ReportWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ReportWorker.name);
  private worker: Worker;

  constructor(
    private readonly drizzle: DrizzleProvider,
    @Inject('BullMQ_Queues') private readonly queues: BullMqQueues,
  ) {}

  onModuleInit(): void {
    const connection = {
      host: redisConfig.host,
      port: redisConfig.port,
      password: redisConfig.password || undefined,
    };

    this.worker = new Worker(
      REPORT_QUEUE,
      async (job: Job) => {
        const { type, data } = job.data;

        switch (type) {
          case 'ticket-report':
            await this.generateTicketReport(data.ticketId, data.requestedBy);
            break;
          case 'sla-report':
            await this.generateSlaReport(data.from, data.to, data.requestedBy);
            break;
          case 'weekly-report':
            await this.generateWeeklyReport(data.requestedBy);
            break;
          default:
            this.logger.warn(`Type de rapport inconnu: ${type}`);
        }
      },
      {
        connection,
        concurrency: 3,
        removeOnComplete: { age: 86400 },
        removeOnFail: { age: 604800 },
      },
    );

    this.worker.on('completed', (job) => this.logger.log(`Rapport terminé: job ${job.id} — ${job.data.type}`));
    this.worker.on('failed', (job, err) => this.logger.error(`Échec rapport: ${err.message}`));
    this.logger.log('Report Worker démarré (concurrency=3)');
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private async getUserEmail(userId: string): Promise<string | null> {
    try {
      const [user] = await this.drizzle.db
        .select({ email: users.email })
        .from(users)
        .where(and(eq(users.id, userId), isNull(users.deletedAt)))
        .limit(1);
      return user?.email ?? null;
    } catch {
      return null;
    }
  }

  /** Envoie une notification in-app au demandeur (non-bloquant) */
  private async notifyUser(
    userId: string,
    type: string,
    title: string,
    message: string,
    referenceId?: string,
  ): Promise<void> {
    try {
      await this.queues.notification.add('create-notification', {
        userId,
        type,
        title,
        message,
        referenceType: 'report',
        referenceId: referenceId || null,
      });
    } catch (err) {
      this.logger.warn(`Notification queue indisponible: ${String(err)}`);
    }
  }

  /** Envoie un email au demandeur (non-bloquant) */
  private async sendEmail(to: string, subject: string, template: string, data: Record<string, unknown>): Promise<void> {
    try {
      await this.queues.email.add('send-email', { to, subject, template, data });
    } catch (err) {
      this.logger.warn(`Email queue indisponible: ${String(err)}`);
    }
  }

  // ─── Génération des rapports ──────────────────────────────────────────────

  private async generateTicketReport(ticketId: string, requestedBy: string): Promise<void> {
    const [ticket] = await this.drizzle.db
      .select({
        id: tickets.id,
        ticketNumber: tickets.ticketNumber,
        title: tickets.title,
        description: tickets.description,
        status: tickets.status,
        priority: tickets.priority,
        severity: tickets.severity,
        category: tickets.category,
        createdAt: tickets.createdAt,
        resolvedAt: tickets.resolvedAt,
        closedAt: tickets.closedAt,
        customerName: tickets.customerName,
        resolutionSummary: tickets.resolutionSummary,
      })
      .from(tickets)
      .where(and(eq(tickets.id, ticketId), isNull(tickets.deletedAt)))
      .limit(1);

    if (!ticket) {
      this.logger.warn(`Ticket ${ticketId} non trouvé pour rapport`);
      return;
    }

    const ticketNumber = ticket.ticketNumber as string;

    // Notifier le demandeur
    await this.notifyUser(
      requestedBy,
      'REPORT_READY',
      '📄 Rapport ticket prêt',
      `Le rapport pour le ticket ${ticketNumber} (« ${ticket.title} ») a été généré.`,
      ticketId,
    );

    // Envoyer l'email
    const email = await this.getUserEmail(requestedBy);
    if (email) {
      await this.sendEmail(email, `📄 Rapport ticket — ${ticketNumber}`, 'ticketCreated', {
        ticketNumber,
        title: ticket.title,
        priority: ticket.priority,
      });
    }

    this.logger.log(`Rapport ticket généré et notifié: ${ticketNumber} → ${requestedBy}`);
  }

  private async generateSlaReport(from: string, to: string, requestedBy: string): Promise<void> {
    const fromDate = new Date(from);
    const toDate = new Date(to);
    const where = and(gte(tickets.createdAt, fromDate), lte(tickets.createdAt, toDate), isNull(tickets.deletedAt));

    const [stats] = await this.drizzle.db
      .select({
        total: count(),
        breached: sql<number>`COUNT(*) FILTER (WHERE ${tickets.slaBreached} = true)`,
        avgResolutionMinutes: sql<number>`COALESCE(AVG(EXTRACT(EPOCH FROM (${tickets.resolvedAt} - ${tickets.createdAt})) / 60) FILTER (WHERE ${tickets.resolvedAt} IS NOT NULL), 0)`,
      })
      .from(tickets)
      .where(where);

    const total = Number(stats?.total || 0);
    const breached = Number(stats?.breached || 0);
    const avgMin = Math.round(Number(stats?.avgResolutionMinutes || 0));

    // Notifier le demandeur
    await this.notifyUser(
      requestedBy,
      'REPORT_READY',
      '📊 Rapport SLA prêt',
      `Rapport SLA généré: ${total} tickets, ${breached} violations, ${avgMin} min moy.`,
    );

    // Envoyer l'email
    const email = await this.getUserEmail(requestedBy);
    if (email) {
      await this.sendEmail(email, '📊 Rapport SLA', 'slaBreach', {
        ticketNumber: `SLA-${from || 'debut'}-${to || 'fin'}`,
        title: `Rapport SLA: ${total} tickets, ${breached} violations`,
        dueDate: new Date().toISOString(),
      });
    }

    this.logger.log(`Rapport SLA généré et notifié: ${total} tickets, ${breached} breaches → ${requestedBy}`);
  }

  private async generateWeeklyReport(requestedBy: string): Promise<void> {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const where = and(gte(tickets.createdAt, weekAgo), lte(tickets.createdAt, now), isNull(tickets.deletedAt));

    // Stats de la semaine
    const [[totals], [resolved], [openCount], [breached]] = await Promise.all([
      this.drizzle.db.select({ count: count() }).from(tickets).where(where),
      this.drizzle.db
        .select({ count: count() })
        .from(tickets)
        .where(and(where, eq(tickets.status, 'RESOLVED' as const))),
      this.drizzle.db
        .select({ count: count() })
        .from(tickets)
        .where(and(where, sql`${tickets.status} NOT IN ('RESOLVED','CLOSED','CANCELLED')`)),
      this.drizzle.db
        .select({ count: count() })
        .from(tickets)
        .where(and(where, eq(tickets.slaBreached, true))),
    ]);

    const [avgStats] = await this.drizzle.db
      .select({
        avgMin: sql<number>`COALESCE(AVG(EXTRACT(EPOCH FROM (${tickets.resolvedAt} - ${tickets.createdAt})) / 60) FILTER (WHERE ${tickets.resolvedAt} IS NOT NULL), 0)`,
      })
      .from(tickets)
      .where(and(where, sql`${tickets.resolvedAt} IS NOT NULL`));

    const totalCreated = Number(totals?.count || 0);
    const totalResolved = Number(resolved?.count || 0);
    const totalOpen = Number(openCount?.count || 0);
    const slaBreaches = Number(breached?.count || 0);
    const complianceRate = totalCreated > 0 ? ((totalCreated - slaBreaches) / totalCreated * 100).toFixed(1) : '100';
    const avgMin = Math.round(Number(avgStats?.avgMin || 0));

    const weekNumber = String(Math.ceil((now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000)));

    // Notifier le demandeur
    await this.notifyUser(
      requestedBy,
      'REPORT_READY',
      '📈 Rapport hebdomadaire prêt',
      `Rapport S${weekNumber}: ${totalCreated} tickets, ${totalResolved} résolus, ${slaBreaches} violations SLA.`,
    );

    // Envoyer l'email avec le template adminWeeklyReport
    const email = await this.getUserEmail(requestedBy);
    if (email) {
      const dashboardUrl = process.env['DASHBOARD_URL'] || 'http://localhost:3001';
      await this.sendEmail(email, `📈 Rapport Hebdomadaire — Semaine ${weekNumber}`, 'adminWeeklyReport', {
        weekNumber,
        periodStart: weekAgo.toLocaleDateString('fr-FR'),
        periodEnd: now.toLocaleDateString('fr-FR'),
        totalCreated,
        totalResolved,
        totalOpen,
        slaBreaches,
        complianceRate,
        avgResolutionMinutes: avgMin,
        dashboardUrl,
        generatedAt: now.toLocaleString('fr-FR'),
        year: String(now.getFullYear()),
      });
    }

    this.logger.log(`Rapport hebdomadaire S${weekNumber} généré et notifié → ${requestedBy}`);
  }
}
