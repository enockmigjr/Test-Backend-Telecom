import { Controller, Post, Get, Param, Query, HttpCode, HttpStatus, UseGuards, Inject } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
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
  @ApiOperation({ summary: 'Générer un rapport détaillé pour un ticket (asynchrone)' })
  @ApiResponse({ status: 202, description: 'Rapport en cours de génération.' })
  async ticketReport(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    // Lancer la génération en arrière-plan via BullMQ
    await this.queues.report.add('generate-report', {
      type: 'ticket-report',
      data: { ticketId: id, requestedBy: user.sub },
    });
    return { message: 'Rapport en cours de génération. Vous recevrez une notification.', ticketId: id };
  }

  @Get('sla')
  @Roles('ADMINISTRATOR', 'SUPERVISOR')
  @ApiOperation({ summary: 'Rapport SLA sur une période (synchrone — données JSON)' })
  async slaReport(@Query() range: DateRangeDto) {
    return this.reportsService.slaReport(range.from, range.to);
  }

  @Post('sla')
  @Roles('ADMINISTRATOR', 'SUPERVISOR')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Générer un rapport SLA complet en arrière-plan (PDF)' })
  @ApiResponse({ status: 202, description: 'Rapport SLA en cours de génération.' })
  async slaReportAsync(@Query() range: DateRangeDto, @CurrentUser() user: JwtPayload) {
    await this.queues.report.add('generate-report', {
      type: 'sla-report',
      data: { from: range.from, to: range.to, requestedBy: user.sub },
    });
    return { message: 'Rapport SLA en cours de génération.', period: { from: range.from, to: range.to } };
  }
}
