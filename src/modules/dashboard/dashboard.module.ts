import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { DashboardSlaService } from './dashboard-sla.service';

@Module({
  controllers: [DashboardController],
  providers: [DashboardService, DashboardSlaService],
})
export class DashboardModule {}
