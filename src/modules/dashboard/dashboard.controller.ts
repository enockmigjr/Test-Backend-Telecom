import { Controller, Get, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { DateRangeDto } from '../../common/dto/date-range.dto';
import { FieldProjectionInterceptor } from '../../common/interceptors/field-projection.interceptor';

@ApiTags('dashboard')
@ApiBearerAuth()
@Controller('dashboard')
@UseGuards(RolesGuard)
@UseInterceptors(FieldProjectionInterceptor)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('overview')
  @Roles('ADMINISTRATOR', 'SUPERVISOR')
  @ApiOperation({
    summary: 'KPIs globaux de la plateforme',
    description:
      'Retourne les indicateurs clés de performance : volume de tickets, répartition par statut/priorité/sévérité, conformité SLA.\n\n**Rôles autorisés :** ADMINISTRATOR, SUPERVISOR',
  })
  @ApiResponse({ status: 200, description: 'Vue globale avec ticketVolume, byStatus, byPriority, bySeverity, sla.' })
  @ApiResponse({ status: 401, description: 'Token JWT manquant ou expiré.' })
  @ApiResponse({ status: 403, description: 'Rôle insuffisant — ADMINISTRATOR ou SUPERVISOR requis.' })
  async overview(@Query() range: DateRangeDto) {
    return this.dashboardService.overview(range.from, range.to);
  }

  @Get('tickets-by-status')
  @Roles('ADMINISTRATOR', 'SUPERVISOR')
  @ApiOperation({
    summary: 'Tickets par statut avec âge moyen',
    description:
      'Répartition des tickets par statut avec âge moyen en minutes et pourcentage. Filtrable par département.\n\n**Rôles autorisés :** ADMINISTRATOR, SUPERVISOR',
  })
  @ApiQuery({
    name: 'departmentId',
    required: false,
    description: 'Filtrer par département (UUID)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({ status: 200, description: 'Répartition par statut avec avgAgeMinutes et percentage.' })
  @ApiResponse({ status: 401, description: 'Non authentifié.' })
  @ApiResponse({ status: 403, description: 'Rôle insuffisant.' })
  async ticketsByStatus(@Query() range: DateRangeDto, @Query('departmentId') departmentId?: string) {
    return this.dashboardService.ticketsByStatus(range.from, range.to, departmentId);
  }

  @Get('tickets-by-priority')
  @Roles('ADMINISTRATOR', 'SUPERVISOR')
  @ApiOperation({
    summary: 'Tickets par priorité avec breaches SLA',
    description:
      'Répartition des tickets par priorité avec nombre de violations SLA. Filtrable par statut (OPEN, RESOLVED, ALL).\n\n**Rôles autorisés :** ADMINISTRATOR, SUPERVISOR',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['OPEN', 'RESOLVED', 'ALL'],
    description: 'Filtrer par statut de ticket',
  })
  @ApiResponse({ status: 200, description: 'Répartition par priorité avec slaBreaches et percentage.' })
  @ApiResponse({ status: 401, description: 'Non authentifié.' })
  @ApiResponse({ status: 403, description: 'Rôle insuffisant.' })
  async ticketsByPriority(@Query() range: DateRangeDto, @Query('status') status?: string) {
    return this.dashboardService.ticketsByPriority(range.from, range.to, status);
  }

  @Get('departments')
  @Roles('ADMINISTRATOR', 'SUPERVISOR')
  @ApiOperation({
    summary: 'Performance par département',
    description:
      'Statistiques de performance pour chaque département : tickets ouverts, résolus, fermés, conformes SLA, temps moyen de résolution.\n\n**Rôles autorisés :** ADMINISTRATOR, SUPERVISOR',
  })
  @ApiResponse({
    status: 200,
    description:
      'Données de performance par département (nom, total, open, resolved, closed, slaCompliant, slaBreached, avgResolutionMinutes).',
  })
  @ApiResponse({ status: 401, description: 'Non authentifié.' })
  @ApiResponse({ status: 403, description: 'Rôle insuffisant.' })
  async departments(@Query() range: DateRangeDto) {
    return this.dashboardService.departmentsReport(range.from, range.to);
  }

  @Get('sla-compliance')
  @Roles('ADMINISTRATOR', 'SUPERVISOR')
  @ApiOperation({
    summary: 'Conformité SLA détaillée',
    description:
      'Analyse détaillée de la conformité SLA avec résumé global, ventilation par priorité et par catégorie. Filtrable par département, priorité et catégorie.\n\n**Rôles autorisés :** ADMINISTRATOR, SUPERVISOR',
  })
  @ApiQuery({ name: 'departmentId', required: false, description: 'Filtrer par département (UUID)' })
  @ApiQuery({
    name: 'priority',
    required: false,
    enum: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'],
    description: 'Filtrer par priorité',
  })
  @ApiQuery({
    name: 'category',
    required: false,
    description: 'Filtrer par catégorie (NETWORK, BILLING, TECHNICAL, OTHER)',
  })
  @ApiResponse({ status: 200, description: 'Analyse SLA avec summary, byPriority et byCategory.' })
  @ApiResponse({ status: 401, description: 'Non authentifié.' })
  @ApiResponse({ status: 403, description: 'Rôle insuffisant.' })
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
  @ApiOperation({
    summary: 'Charge des agents + tickets non assignés',
    description:
      'Vue de la charge de travail : tickets par agent (total, critiques, haute priorité, à risque SLA) + compteur de tickets non assignés.\n\n**Rôles autorisés :** ADMINISTRATOR, SUPERVISOR',
  })
  @ApiQuery({ name: 'departmentId', required: false, description: 'Filtrer par département (UUID)' })
  @ApiResponse({
    status: 200,
    description:
      'Charge de travail avec data, summary (totalAgents, totalOpenTickets, avgTicketsPerAgent, unassignedTickets).',
  })
  @ApiResponse({ status: 401, description: 'Non authentifié.' })
  @ApiResponse({ status: 403, description: 'Rôle insuffisant.' })
  async workload(@Query('departmentId') departmentId?: string) {
    return this.dashboardService.workload(departmentId);
  }

  @Get('resolution-time')
  @Roles('ADMINISTRATOR', 'SUPERVISOR')
  @ApiOperation({
    summary: 'Temps moyen de résolution',
    description:
      'Statistiques de temps de résolution : moyenne, médiane, P90. Filtrable par regroupement temporel, département et priorité.\n\n**Rôles autorisés :** ADMINISTRATOR, SUPERVISOR',
  })
  @ApiQuery({ name: 'groupBy', required: false, enum: ['day', 'week', 'month'], description: 'Regroupement temporel' })
  @ApiQuery({ name: 'departmentId', required: false, description: 'Filtrer par département (UUID)' })
  @ApiQuery({
    name: 'priority',
    required: false,
    enum: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'],
    description: 'Filtrer par priorité',
  })
  @ApiResponse({
    status: 200,
    description: 'Statistiques de temps de résolution avec overall (avg, median, p90) et trend.',
  })
  @ApiResponse({ status: 401, description: 'Non authentifié.' })
  @ApiResponse({ status: 403, description: 'Rôle insuffisant.' })
  async resolutionTime(
    @Query() range: DateRangeDto,
    @Query('groupBy') groupBy?: string,
    @Query('departmentId') departmentId?: string,
    @Query('priority') priority?: string,
  ) {
    return this.dashboardService.resolutionTime(range.from, range.to, groupBy, departmentId, priority);
  }
}
