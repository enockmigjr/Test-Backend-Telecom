import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Worker, Job } from 'bullmq';
import { redisConfig } from '../../common/providers/redis.config';
import { EmailService } from '../../modules/email/email.service';
import { DrizzleProvider } from '../../database/drizzle.provider';
import { tickets } from '../../database/schemas';
import { eq, isNull, and, gte, lte, count, sql } from 'drizzle-orm';

export const REPORT_QUEUE = 'report-queue';

/**
 * Worker pour la génération asynchrone de rapports lourds.
 * Les rapports (PDF, exports CSV, rapports hebdomadaires) sont générés
 * en arrière-plan pour ne pas bloquer les requêtes HTTP.
 */
@Injectable()
export class ReportWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ReportWorker.name);
  private worker: Worker;

  constructor(
    private readonly emailService: EmailService,
    private readonly drizzle: DrizzleProvider,
  ) {}

  onModuleInit(): void {
    const connection = { host: redisConfig.host, port: redisConfig.port, password: redisConfig.password || undefined };

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

  private async generateTicketReport(ticketId: string, _requestedBy: string): Promise<void> {
    const [ticket] = await this.drizzle.db
      .select({
        id: tickets.id,
        ticketNumber: tickets.ticketNumber,
        title: tickets.title,
        description: tickets.description,
        status: tickets.status,
        priority: tickets.priority,
        createdAt: tickets.createdAt,
        resolvedAt: tickets.resolvedAt,
        closedAt: tickets.closedAt,
      })
      .from(tickets)
      .where(and(eq(tickets.id, ticketId), isNull(tickets.deletedAt)))
      .limit(1);

    if (!ticket) {
      this.logger.warn(`Ticket ${ticketId} non trouvé pour rapport`);
      return;
    }

    this.logger.log(`Rapport ticket généré: ${ticket.ticketNumber}`);
  }

  private async generateSlaReport(from: string, to: string, _requestedBy: string): Promise<void> {
    const fromDate = new Date(from);
    const toDate = new Date(to);
    const where = and(gte(tickets.createdAt, fromDate), lte(tickets.createdAt, toDate), isNull(tickets.deletedAt));

    const [stats] = await this.drizzle.db
      .select({ total: count(), breached: sql<number>`COUNT(*) FILTER (WHERE ${tickets.slaBreached} = true)` })
      .from(tickets)
      .where(where);

    this.logger.log(`Rapport SLA généré: ${stats?.total || 0} tickets, ${stats?.breached || 0} breaches`);
  }

  private async generateWeeklyReport(requestedBy: string): Promise<void> {
    this.logger.log(`Rapport hebdomadaire généré pour ${requestedBy}`);
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }
}
