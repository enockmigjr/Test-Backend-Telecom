import { Injectable, Logger, Inject } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { eq, isNull, and } from 'drizzle-orm';
import { Queue } from 'bullmq';
import { generateUuid } from '../../common/helpers/uuidv7.helper';
import { DrizzleProvider } from '../../database/drizzle.provider';
import { users } from '../../database/schemas';
import { ReportsService } from './reports.service';

interface BullMqReportQueues {
  report: Queue;
  [key: string]: Queue;
}

/**
 * Service dédié au scheduling automatique des rapports.
 * Responsabilité unique : déclenchement périodique (cron) des rapports.
 * La génération elle-même est déléguée à ReportsService.
 */
@Injectable()
export class ReportSchedulerService {
  private readonly logger = new Logger(ReportSchedulerService.name);

  constructor(
    private readonly drizzle: DrizzleProvider,
    private readonly reportsService: ReportsService,
    @Inject('BullMQ_Queues') private readonly queues: BullMqReportQueues,
  ) {}

  /**
   * Cron hebdomadaire exécuté tous les lundis à 6h00 du matin.
   * Génère automatiquement le rapport hebdomadaire pour le premier administrateur actif.
   */
  @Cron('0 6 * * 1')
  async handleWeeklyReportCron(): Promise<void> {
    this.logger.log('Déclenchement automatique du rapport hebdomadaire...');
    try {
      const [admin] = await this.drizzle.db
        .select({ id: users.id, email: users.email })
        .from(users)
        .where(and(eq(users.role, 'ADMINISTRATOR'), isNull(users.deletedAt)))
        .limit(1);

      if (!admin) {
        this.logger.warn('Aucun administrateur actif trouvé pour recevoir le rapport hebdomadaire.');
        return;
      }

      const reportId = generateUuid();
      await this.reportsService.createReport({
        id: reportId,
        type: 'weekly-report',
        status: 'pending',
        requestedBy: admin.id,
        metadata: { automated: true },
      });

      await this.queues.report.add('generate-report', {
        type: 'weekly-report',
        data: { reportId, requestedBy: admin.id },
      });

      this.logger.log(
        `Job de rapport hebdomadaire automatique créé avec succès (ID: ${reportId}) pour ${admin.email}`,
      );
    } catch (err) {
      this.logger.error(`Erreur lors du déclenchement du rapport hebdomadaire automatique: ${String(err)}`);
    }
  }
}
