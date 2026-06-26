import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
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

  @Get('tickets-by-status')
  @Roles('ADMINISTRATOR', 'SUPERVISOR')
  @ApiOperation({ summary: 'Tickets par statut avec âge moyen' })
  @ApiQuery({ name: 'departmentId', required: false })
  async ticketsByStatus(@Query() range: DateRangeDto, @Query('departmentId') departmentId?: string) {
    return this.dashboardService.ticketsByStatus(range.from, range.to, departmentId);
  }

  @Get('tickets-by-priority')
  @Roles('ADMINISTRATOR', 'SUPERVISOR')
  @ApiOperation({ summary: 'Tickets par priorité avec breaches SLA' })
  @ApiQuery({ name: 'status', required: false, enum: ['OPEN', 'RESOLVED', 'ALL'] })
  async ticketsByPriority(@Query() range: DateRangeDto, @Query('status') status?: string) {
    return this.dashboardService.ticketsByPriority(range.from, range.to, status);
  }

  @Get('departments')
  @Roles('ADMINISTRATOR', 'SUPERVISOR')
  @ApiOperation({ summary: 'Performance par département' })
  async departments(@Query() range: DateRangeDto) {
    return this.dashboardService.departmentsReport(range.from, range.to);
  }

  @Get('sla-compliance')
  @Roles('ADMINISTRATOR', 'SUPERVISOR')
  @ApiOperation({ summary: 'Conformité SLA détaillée avec tendance journalière' })
  @ApiQuery({ name: 'departmentId', required: false })
  @ApiQuery({ name: 'priority', required: false })
  @ApiQuery({ name: 'category', required: false })
  async slaCompliance(
    @Query() range: DateRangeDto,
    @Query('departmentId') departmentId?: string,
    @Query('priority') priority?: string,
    @Query('category') category?: string,
  ) {
    return this.dashboardService.slaCompliance(range.from, range.to, departmentId, priority, category);
  }

  @Get('workload')
  @Roles('ADMINISTRATOR', 'SUPERVISOR')
  @ApiOperation({ summary: 'Charge des agents + tickets non assignés' })
  @ApiQuery({ name: 'departmentId', required: false })
  async workload(@Query('departmentId') departmentId?: string) {
    return this.dashboardService.workload(departmentId);
  }

  @Get('resolution-time')
  @Roles('ADMINISTRATOR', 'SUPERVISOR')
  @ApiOperation({ summary: 'Temps moyen de résolution (avg, median, p90) + tendance' })
  @ApiQuery({ name: 'groupBy', required: false, enum: ['day', 'week', 'month'] })
  @ApiQuery({ name: 'departmentId', required: false })
  @ApiQuery({ name: 'priority', required: false })
  async resolutionTime(
    @Query() range: DateRangeDto,
    @Query('groupBy') groupBy?: string,
    @Query('departmentId') departmentId?: string,
    @Query('priority') priority?: string,
  ) {
    return this.dashboardService.resolutionTime(range.from, range.to, groupBy, departmentId, priority);
  }
}
