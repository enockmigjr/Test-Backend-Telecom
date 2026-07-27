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
  exports: [ReportsService, ReportDownloadLinkService],
})
export class ReportsModule {}
