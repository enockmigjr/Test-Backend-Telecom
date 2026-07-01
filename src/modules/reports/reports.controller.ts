import { Controller, Post, Get, Param, Query, HttpCode, HttpStatus, UseGuards, Inject } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { Queue } from 'bullmq';
import { ReportsService } from './reports.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { DateRangeDto } from '../../common/dto/date-range.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

@ApiTags('reports')
@ApiBearerAuth()
@Controller('reports')
@UseGuards(RolesGuard)
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    @Inject('BullMQ_Queues') private readonly queues: { report: Queue },
  ) {}

  @Post('ticket/:id')
  @Roles('ADMINISTRATOR', 'SUPERVISOR')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Générer un rapport détaillé pour un ticket (asynchrone)',
    description:
      "Lance la génération en arrière-plan d'un rapport PDF détaillé pour un ticket spécifique. L'utilisateur recevra une notification lorsque le rapport sera prêt.\n\n**Rôles autorisés :** ADMINISTRATOR, SUPERVISOR",
  })
  @ApiParam({ name: 'id', description: 'UUID du ticket', example: '01922b3c-d4e5-7f8a-9b1c-2d3e4f5a6b7c' })
  @ApiResponse({ status: 202, description: 'Rapport en cours de génération. Vous recevrez une notification.' })
  @ApiResponse({ status: 401, description: 'Token JWT manquant ou expiré.' })
  @ApiResponse({ status: 403, description: 'Rôle insuffisant — ADMINISTRATOR ou SUPERVISOR requis.' })
  @ApiResponse({ status: 404, description: 'Ticket non trouvé.' })
  async ticketReport(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    await this.queues.report.add('generate-report', {
      type: 'ticket-report',
      data: { ticketId: id, requestedBy: user.sub },
    });
    return { message: 'Rapport en cours de génération. Vous recevrez une notification.', ticketId: id };
  }

  @Get('sla')
  @Roles('ADMINISTRATOR', 'SUPERVISOR')
  @ApiOperation({
    summary: 'Rapport SLA sur une période (synchrone — données JSON)',
    description:
      'Retourne les données du rapport SLA pour une période donnée : total tickets, violations SLA, temps moyen de résolution, ventilation par priorité.\n\n**Rôles autorisés :** ADMINISTRATOR, SUPERVISOR',
  })
  @ApiResponse({
    status: 200,
    description: 'Rapport SLA avec summary (total, breached, avgResolutionMinutes) et byPriority.',
  })
  @ApiResponse({ status: 401, description: 'Non authentifié.' })
  @ApiResponse({ status: 403, description: 'Rôle insuffisant.' })
  async slaReport(@Query() range: DateRangeDto) {
    return this.reportsService.slaReport(range.from, range.to);
  }

  @Post('sla')
  @Roles('ADMINISTRATOR', 'SUPERVISOR')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Générer un rapport SLA complet en arrière-plan (PDF)',
    description:
      "Lance la génération en arrière-plan d'un rapport SLA complet au format PDF pour la période spécifiée. Une notification sera envoyée lorsque le rapport est prêt.\n\n**Rôles autorisés :** ADMINISTRATOR, SUPERVISOR",
  })
  @ApiQuery({ name: 'from', required: false, description: 'Date de début (ISO 8601)', example: '2026-01-01T00:00:00Z' })
  @ApiQuery({ name: 'to', required: false, description: 'Date de fin (ISO 8601)', example: '2026-06-30T23:59:59Z' })
  @ApiResponse({ status: 202, description: 'Rapport SLA en cours de génération.' })
  @ApiResponse({ status: 401, description: 'Non authentifié.' })
  @ApiResponse({ status: 403, description: 'Rôle insuffisant.' })
  async slaReportAsync(@Query() range: DateRangeDto, @CurrentUser() user: JwtPayload) {
    await this.queues.report.add('generate-report', {
      type: 'sla-report',
      data: { from: range.from, to: range.to, requestedBy: user.sub },
    });
    return { message: 'Rapport SLA en cours de génération.', period: { from: range.from, to: range.to } };
  }
}
