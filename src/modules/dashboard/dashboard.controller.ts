import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { DateRangeDto } from '../../common/dto/date-range.dto';

@ApiTags('dashboard')
@ApiBearerAuth()
@Controller('dashboard')
@UseGuards(RolesGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('overview')
  @Roles('ADMINISTRATOR', 'SUPERVISOR')
  @ApiOperation({ summary: 'KPIs globaux de la plateforme' })
  async overview(@Query() range: DateRangeDto) {
    return this.dashboardService.overview(range.from, range.to);
  }

  @Get('departments')
  @Roles('ADMINISTRATOR', 'SUPERVISOR')
  @ApiOperation({ summary: 'Performance par département' })
  async departments(@Query() range: DateRangeDto) {
    return this.dashboardService.departments_report(range.from, range.to);
  }

  @Get('workload')
  @Roles('ADMINISTRATOR', 'SUPERVISOR')
  @ApiOperation({ summary: 'Charge des agents et tickets non assignés' })
  async workload() {
    return this.dashboardService.workload();
  }
}
