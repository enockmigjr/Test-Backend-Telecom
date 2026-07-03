import { Module, forwardRef } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { QueuesModule } from '../../queues/queues.module';

@Module({
  imports: [forwardRef(() => QueuesModule)],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
