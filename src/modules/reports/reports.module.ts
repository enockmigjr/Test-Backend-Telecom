import { Module, forwardRef } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { ReportSchedulerService } from './report-scheduler.service';
import { QueuesModule } from '../../queues/queues.module';
import { ReportQueryService } from './report-query.service';
import { ReportDownloadService } from './report-download.service';

@Module({
  imports: [forwardRef(() => QueuesModule)],
  controllers: [ReportsController],
  providers: [ReportsService, ReportQueryService, ReportDownloadService, ReportSchedulerService],
  exports: [ReportsService],
})
export class ReportsModule {}
