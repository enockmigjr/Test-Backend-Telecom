/**
 * ============================================================================
 * FICHIER : src/modules/reports/reports.module.ts
 * RÔLE : Module NestJS organisant le composant reports.
 * EXPLICATION :
 * Ce module regroupe et configure les contrôleurs, services, répertoires et dépendances de reports.
 * 1. Définit les éléments internes du domaine fonctionnel.
 * 2. Rend les services accessibles aux autres modules ayant importé celui-ci.
 * ============================================================================
 */

import { Module, forwardRef } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { ReportSchedulerService } from './report-scheduler.service';
import { QueuesModule } from '../../queues/queues.module';
import { ReportQueryService } from './report-query.service';
import { ReportDownloadService } from './report-download.service';
import { ReportDownloadLinkService } from './report-download-link.service';
import { PublicReportsController } from './public-reports.controller';

@Module({
  imports: [forwardRef(() => QueuesModule)],
  controllers: [ReportsController, PublicReportsController],
  providers: [
    ReportsService,
    ReportQueryService,
    ReportDownloadService,
    ReportDownloadLinkService,
    ReportSchedulerService,
  ],
  exports: [ReportsService, ReportQueryService, ReportDownloadLinkService],
})
/**
 * Module NestJS `ReportsModule` configurant les dépendances, contrôleurs et services associés.
 */
export class ReportsModule {}
