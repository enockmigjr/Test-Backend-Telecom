import { Controller, Post, Get, Param, Query, HttpCode, HttpStatus, UseGuards, Inject } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
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
@Roles('ADMINISTRATOR', 'SUPERVISOR')
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    @Inject('BullMQ_Queues') private readonly queues: { report: Queue },
  ) {}

  @Get('ticket/:id')
  @ApiOperation({
    summary: 'Obtenir les donnees du rapport d un ticket (synchrone — données JSON)',
    description: 'Retourne les details du ticket sous format JSON.\n\n**Rôles autorises :** ADMINISTRATOR, SUPERVISOR',
  })
  @ApiParam({ name: 'id', description: 'UUID du ticket' })
  @ApiResponse({ status: 200, description: 'Donnees du rapport retournees.' })
  @ApiResponse({ status: 404, description: 'Ticket non trouve.' })
  async getTicketReport(@Param('id') id: string) {
    return this.reportsService.ticketReport(id);
  }

  @Post('ticket/:id/generate')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Generer un rapport PDF detaille pour un ticket (asynchrone)',
    description:
      'Lance la generation en arriere-plan du rapport PDF.\n\n**Rôles autorises :** ADMINISTRATOR, SUPERVISOR',
  })
  @ApiParam({ name: 'id', description: 'UUID du ticket' })
  @ApiResponse({ status: 202, description: 'Rapport en cours de generation.' })
  async ticketReport(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    // Verifier d abord que le ticket existe
    await this.reportsService.ticketReport(id);

    await this.queues.report.add('generate-report', {
      type: 'ticket-report',
      data: { ticketId: id, requestedBy: user.sub },
    });
    return { message: 'Rapport en cours de generation. Vous recevrez une notification.', ticketId: id };
  }

  @Get('sla')
  @ApiOperation({
    summary: 'Rapport SLA sur une periode (synchrone — données JSON)',
    description: 'Retourne les metriques SLA format JSON.\n\n**Rôles autorises :** ADMINISTRATOR, SUPERVISOR',
  })
  @ApiResponse({ status: 200, description: 'Metriques SLA.' })
  async slaReport(@Query() range: DateRangeDto) {
    return this.reportsService.slaReport(range.from, range.to);
  }

  @Post('sla/generate')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Generer un rapport SLA PDF (asynchrone)',
    description:
      'Lance la generation en arriere-plan du rapport SLA PDF.\n\n**Rôles autorises :** ADMINISTRATOR, SUPERVISOR',
  })
  @ApiResponse({ status: 202, description: 'Rapport SLA en cours de generation.' })
  async slaReportAsync(@Query() range: DateRangeDto, @CurrentUser() user: JwtPayload) {
    await this.queues.report.add('generate-report', {
      type: 'sla-report',
      data: { from: range.from, to: range.to, requestedBy: user.sub },
    });
    return { message: 'Rapport SLA en cours de generation.', period: { from: range.from, to: range.to } };
  }
}
