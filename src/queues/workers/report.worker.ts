import { Injectable, Logger, OnModuleInit, OnModuleDestroy, Inject } from '@nestjs/common';
import { Worker, Job, Queue } from 'bullmq';
import { generateUuid } from '../../common/helpers/uuidv7.helper';
import { eq, and, isNull, gte, lte, count, sql } from 'drizzle-orm';
import { redisConfig } from '../../common/providers/redis.config';
import { REPORT_QUEUE } from '../queues.module';
import { DrizzleProvider } from '../../database/drizzle.provider';
import { tickets, users, departments } from '../../database/schemas';
import { ReportsService } from '../../modules/reports/reports.service';
import { LocalStorageService } from '../../modules/attachments/storage/local-storage.service';

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
    private readonly reportsService: ReportsService,
    private readonly storage: LocalStorageService,
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

        let reportId = data.reportId;
        if (!reportId) {
          reportId = generateUuid();
          try {
            await this.reportsService.createReport({
              id: reportId,
              type: type === 'weekly-report' ? 'weekly-report' : type,
              status: 'pending',
              requestedBy: data.requestedBy || '00000000-0000-0000-0000-000000000000', // valeur factice si système
            });
          } catch (e) {
            this.logger.warn(`Impossible de creer la ligne de rapport en DB: ${String(e)}`);
          }
        }

        switch (type) {
          case 'ticket-report':
            await this.generateTicketReport(reportId, data.ticketId, data.requestedBy);
            break;
          case 'sla-report':
            await this.generateSlaReport(reportId, data.from, data.to, data.requestedBy);
            break;
          case 'weekly-report':
            await this.generateWeeklyReport(reportId, data.requestedBy);
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
  private async sendEmail(
    to: string,
    subject: string,
    template: string,
    data: Record<string, unknown>,
    attachments?: Array<{ filename: string; content: string }>,
  ): Promise<void> {
    try {
      await this.queues.email.add('send-email', { to, subject, template, data, attachments });
    } catch (err) {
      this.logger.warn(`Email queue indisponible: ${String(err)}`);
    }
  }

  // ─── Génération des rapports ──────────────────────────────────────────────

  private async generateTicketReport(reportId: string, ticketId: string, requestedBy: string): Promise<void> {
    try {
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
          departmentName: departments.name,
        })
        .from(tickets)
        .leftJoin(departments, eq(tickets.departmentId, departments.id))
        .where(and(eq(tickets.id, ticketId), isNull(tickets.deletedAt)))
        .limit(1);

      if (!ticket) {
        throw new Error(`Ticket ${ticketId} introuvable ou supprime`);
      }

      const ticketNumber = ticket.ticketNumber as string;

      // Générer le PDF
      const pdfBuffer = await this.reportsService.generateTicketPdf(ticket);

      // Stocker le PDF
      const year = new Date().getFullYear();
      const month = String(new Date().getMonth() + 1).padStart(2, '0');
      const objectKey = `reports/${year}/${month}/${reportId}.pdf`;

      const pseudoFile = {
        buffer: pdfBuffer,
        originalname: `Rapport-Ticket-${ticketNumber}.pdf`,
        mimetype: 'application/pdf',
        size: pdfBuffer.length,
        fieldname: 'file',
        encoding: '7bit',
      } as Express.Multer.File;

      await this.storage.upload(pseudoFile, objectKey);

      // Mettre à jour la DB
      await this.reportsService.updateReportStatus(reportId, 'completed', objectKey);

      const appUrl = process.env['APP_URL'] || 'http://localhost:3000';
      const downloadUrl = `${appUrl}/api/v1/reports/${reportId}/download`;

      // Notifier le demandeur
      await this.notifyUser(
        requestedBy,
        'REPORT_READY',
        '📄 Rapport ticket prêt',
        `Le rapport pour le ticket ${ticketNumber} (« ${ticket.title} ») a ete genere.`,
        reportId,
      );

      // Envoyer l'email
      const email = await this.getUserEmail(requestedBy);
      if (email) {
        await this.sendEmail(email, `📄 Rapport ticket — ${ticketNumber}`, 'ticketReport', {
          ticketNumber,
          title: ticket.title,
          downloadUrl,
          ticketUrl: `${appUrl}/tickets/${ticket.id}`,
        });
      }

      this.logger.log(`Rapport ticket genere, stocke et notifie: ${ticketNumber} (ID: ${reportId}) → ${requestedBy}`);
    } catch (err) {
      const errorMessage = (err as Error).message || String(err);
      this.logger.error(`Echec de generation du rapport de ticket ${ticketId}: ${errorMessage}`);

      try {
        // Enregistrer l'échec
        await this.reportsService.updateReportStatus(reportId, 'failed', undefined, errorMessage);

        // Notifier l'échec
        await this.notifyUser(
          requestedBy,
          'REPORT_FAILED',
          '❌ Echec du rapport ticket',
          `La generation du rapport pour le ticket ID ${ticketId} a echoue : ${errorMessage}`,
          reportId,
        );

        // Envoyer l'e-mail d'erreur obligatoire
        const email = await this.getUserEmail(requestedBy);
        if (email) {
          await this.sendEmail(email, `❌ Echec de generation du rapport — Ticket ${ticketId}`, 'reportFailed', {
            reportId,
            errorMessage,
          });
        }
      } catch (dbErr) {
        this.logger.error(`Impossible d'enregistrer l'echec du rapport en DB: ${String(dbErr)}`);
      }
    }
  }

  private async generateSlaReport(reportId: string, from: string, to: string, requestedBy: string): Promise<void> {
    try {
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

      const byPriority = await this.drizzle.db
        .select({
          priority: tickets.priority,
          count: count(),
          breached: sql<number>`COUNT(*) FILTER (WHERE ${tickets.slaBreached} = true)`,
        })
        .from(tickets)
        .where(where)
        .groupBy(tickets.priority);

      const total = Number(stats?.total || 0);
      const breached = Number(stats?.breached || 0);
      const avgMin = Math.round(Number(stats?.avgResolutionMinutes || 0));

      // Générer le PDF
      const pdfBuffer = await this.reportsService.generateSlaPdf(
        { total, breached, avgResolutionMinutes: avgMin },
        byPriority,
        { from: fromDate, to: toDate },
      );

      // Stocker le PDF
      const year = new Date().getFullYear();
      const month = String(new Date().getMonth() + 1).padStart(2, '0');
      const objectKey = `reports/${year}/${month}/${reportId}.pdf`;

      const pseudoFile = {
        buffer: pdfBuffer,
        originalname: `Rapport-SLA-${from || 'debut'}-${to || 'fin'}.pdf`,
        mimetype: 'application/pdf',
        size: pdfBuffer.length,
        fieldname: 'file',
        encoding: '7bit',
      } as Express.Multer.File;

      await this.storage.upload(pseudoFile, objectKey);

      // Mettre à jour la DB
      await this.reportsService.updateReportStatus(reportId, 'completed', objectKey);

      const appUrl = process.env['APP_URL'] || 'http://localhost:3000';
      const downloadUrl = `${appUrl}/api/v1/reports/${reportId}/download`;

      // Notifier le demandeur
      await this.notifyUser(
        requestedBy,
        'REPORT_READY',
        '📊 Rapport SLA prêt',
        `Rapport SLA genere: ${total} tickets, ${breached} violations, ${avgMin} min moy.`,
        reportId,
      );

      // Envoyer l'email
      const email = await this.getUserEmail(requestedBy);
      if (email) {
        const dashboardUrl = process.env['DASHBOARD_URL'] || 'http://localhost:3001';
        await this.sendEmail(email, '📊 Rapport SLA', 'slaReport', {
          periodStart: fromDate.toLocaleDateString('fr-FR'),
          periodEnd: toDate.toLocaleDateString('fr-FR'),
          totalCreated: total,
          slaBreaches: breached,
          downloadUrl,
          dashboardUrl,
        });
      }

      this.logger.log(`Rapport SLA genere, stocke et notifie: ${total} tickets (ID: ${reportId}) → ${requestedBy}`);
    } catch (err) {
      const errorMessage = (err as Error).message || String(err);
      this.logger.error(`Echec de generation du rapport SLA (${from} à ${to}): ${errorMessage}`);

      try {
        // Enregistrer l'échec
        await this.reportsService.updateReportStatus(reportId, 'failed', undefined, errorMessage);

        // Notifier l'échec
        await this.notifyUser(
          requestedBy,
          'REPORT_FAILED',
          '❌ Echec du rapport SLA',
          `La generation du rapport SLA (${from} à ${to}) a echoue : ${errorMessage}`,
          reportId,
        );

        // Envoyer l'e-mail d'erreur obligatoire
        const email = await this.getUserEmail(requestedBy);
        if (email) {
          await this.sendEmail(
            email,
            `❌ Echec de generation du rapport SLA — Periode ${from} - ${to}`,
            'reportFailed',
            {
              reportId,
              errorMessage,
            },
          );
        }
      } catch (dbErr) {
        this.logger.error(`Impossible d'enregistrer l'echec du rapport SLA en DB: ${String(dbErr)}`);
      }
    }
  }

  private async generateWeeklyReport(reportId: string, requestedBy: string): Promise<void> {
    try {
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

      const byPriority = await this.drizzle.db
        .select({
          priority: tickets.priority,
          count: count(),
          breached: sql<number>`COUNT(*) FILTER (WHERE ${tickets.slaBreached} = true)`,
        })
        .from(tickets)
        .where(where)
        .groupBy(tickets.priority);

      const totalCreated = Number(totals?.count || 0);
      const totalResolved = Number(resolved?.count || 0);
      const totalOpen = Number(openCount?.count || 0);
      const slaBreaches = Number(breached?.count || 0);
      const complianceRate =
        totalCreated > 0 ? (((totalCreated - slaBreaches) / totalCreated) * 100).toFixed(1) : '100';
      const avgMin = Math.round(Number(avgStats?.avgMin || 0));

      const weekNumber = String(
        Math.ceil((now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000)),
      );

      // Générer le PDF
      const pdfBuffer = await this.reportsService.generateSlaPdf(
        { total: totalCreated, breached: slaBreaches, avgResolutionMinutes: avgMin },
        byPriority,
        { from: weekAgo, to: now },
      );

      // Stocker le PDF
      const year = new Date().getFullYear();
      const month = String(new Date().getMonth() + 1).padStart(2, '0');
      const objectKey = `reports/${year}/${month}/${reportId}.pdf`;

      const pseudoFile = {
        buffer: pdfBuffer,
        originalname: `Rapport-Hebdomadaire-S${weekNumber}.pdf`,
        mimetype: 'application/pdf',
        size: pdfBuffer.length,
        fieldname: 'file',
        encoding: '7bit',
      } as Express.Multer.File;

      await this.storage.upload(pseudoFile, objectKey);

      // Mettre à jour la DB
      await this.reportsService.updateReportStatus(reportId, 'completed', objectKey);

      const appUrl = process.env['APP_URL'] || 'http://localhost:3000';
      const downloadUrl = `${appUrl}/api/v1/reports/${reportId}/download`;

      // Notifier le demandeur
      await this.notifyUser(
        requestedBy,
        'REPORT_READY',
        '📈 Rapport hebdomadaire prêt',
        `Rapport S${weekNumber}: ${totalCreated} tickets, ${totalResolved} resolus, ${slaBreaches} violations SLA.`,
        reportId,
      );

      // Envoyer l'email
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
          downloadUrl,
          dashboardUrl,
          generatedAt: now.toLocaleString('fr-FR'),
          year: String(now.getFullYear()),
        });
      }

      this.logger.log(
        `Rapport hebdomadaire S${weekNumber} genere, stocke et notifie (ID: ${reportId}) → ${requestedBy}`,
      );
    } catch (err) {
      const errorMessage = (err as Error).message || String(err);
      this.logger.error(`Echec de generation du rapport hebdomadaire: ${errorMessage}`);

      try {
        // Enregistrer l'échec
        await this.reportsService.updateReportStatus(reportId, 'failed', undefined, errorMessage);

        // Notifier l'échec
        await this.notifyUser(
          requestedBy,
          'REPORT_FAILED',
          '❌ Echec du rapport hebdomadaire',
          `La generation du rapport hebdomadaire a echoue : ${errorMessage}`,
          reportId,
        );

        // Envoyer l'e-mail d'erreur obligatoire
        const email = await this.getUserEmail(requestedBy);
        if (email) {
          await this.sendEmail(email, `❌ Echec de generation du rapport hebdomadaire`, 'reportFailed', {
            reportId,
            errorMessage,
          });
        }
      } catch (dbErr) {
        this.logger.error(`Impossible d'enregistrer l'echec du rapport hebdomadaire en DB: ${String(dbErr)}`);
      }
    }
  }
}
