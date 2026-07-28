import { Controller, Post, Get, Param, Query, HttpCode, HttpStatus, UseGuards, Inject, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { Queue } from 'bullmq';
import { Response } from 'express';
import { ReportsService } from './reports.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { DateRangeDto } from '../../common/dto/date-range.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { generateUuid } from '../../common/helpers/uuidv7.helper';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { ReportDownloadService } from './report-download.service';

@ApiTags('reports')
@ApiBearerAuth()
@Controller('reports')
@UseGuards(RolesGuard)
@Roles('ADMINISTRATOR', 'SUPERVISOR')
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    @Inject('BullMQ_Queues') private readonly queues: { report: Queue },
    private readonly reportDownload: ReportDownloadService,
  ) {}

  @Get('ticket/:id')
  @ApiOperation({
    summary: 'Obtenir les donnees du rapport d un ticket (synchrone — données JSON)',
    description: 'Retourne les details du ticket sous format JSON.\n\n**Rôles autorises :** ADMINISTRATOR, SUPERVISOR',
  })
  @ApiParam({ name: 'id', description: 'UUID du ticket' })
  @ApiResponse({ status: 200, description: 'Donnees du rapport retournees.' })
  @ApiResponse({ status: 404, description: 'Ticket non trouve.' })
  async getTicketReport(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.reportsService.ticketReport(id, user);
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
    await this.reportsService.ticketReport(id, user);

    const reportId = generateUuid();
    await this.reportsService.createReport({
      id: reportId,
      type: 'ticket-report',
      status: 'pending',
      requestedBy: user.sub,
      metadata: { ticketId: id },
    });

    await this.queues.report.add('generate-report', {
      type: 'ticket-report',
      data: { reportId, ticketId: id, requestedBy: user.sub },
    });

    return {
      message: 'Rapport en cours de generation. Vous recevrez une notification.',
      reportId,
    };
  }

  @Get('sla')
  @ApiOperation({
    summary: 'Rapport SLA sur une periode (synchrone — données JSON)',
    description: 'Retourne les metriques SLA format JSON.\n\n**Rôles autorises :** ADMINISTRATOR, SUPERVISOR',
  })
  @ApiResponse({ status: 200, description: 'Metriques SLA.' })
  async slaReport(@Query() range: DateRangeDto, @CurrentUser() user: JwtPayload) {
    const departmentId = user.role === 'ADMINISTRATOR' ? undefined : user.departmentId;
    return this.reportsService.slaReport(range.from, range.to, departmentId);
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
    const departmentId = user.role === 'ADMINISTRATOR' ? undefined : user.departmentId;
    const reportId = generateUuid();
    await this.reportsService.createReport({
      id: reportId,
      type: 'sla-report',
      status: 'pending',
      requestedBy: user.sub,
      metadata: { from: range.from, to: range.to, departmentId },
    });

    await this.queues.report.add('generate-report', {
      type: 'sla-report',
      data: { reportId, from: range.from, to: range.to, departmentId, requestedBy: user.sub },
    });

    return {
      message: 'Rapport SLA en cours de generation. Vous recevrez une notification.',
      reportId,
    };
  }

  @Post('weekly/generate')
  @Roles('ADMINISTRATOR')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Generer un rapport hebdomadaire PDF (asynchrone)',
    description:
      'Lance la generation en arriere-plan du rapport hebdomadaire PDF.\n\n**Rôles autorises :** ADMINISTRATOR, SUPERVISOR',
  })
  @ApiResponse({ status: 202, description: 'Rapport hebdomadaire en cours de generation.' })
  async weeklyReportAsync(@CurrentUser() user: JwtPayload) {
    const reportId = generateUuid();
    await this.reportsService.createReport({
      id: reportId,
      type: 'weekly-report',
      status: 'pending',
      requestedBy: user.sub,
      metadata: { manual: true },
    });

    await this.queues.report.add('generate-report', {
      type: 'weekly-report',
      data: { reportId, requestedBy: user.sub },
    });

    return {
      message: 'Rapport hebdomadaire en cours de generation. Vous recevrez une notification.',
      reportId,
    };
  }

  @Get()
  @ApiOperation({
    summary: 'Lister les rapports générés',
    description:
      'Retourne tous les rapports pour un administrateur et uniquement ses propres rapports pour un superviseur.',
  })
  @ApiResponse({ status: 200, description: 'Liste des rapports.' })
  @ApiResponse({ status: 403, description: 'Acces refuse (rôle insuffisant).' })
  async listReports(@Query() pagination: PaginationDto, @CurrentUser() user: JwtPayload) {
    const requestedBy = user.role === 'ADMINISTRATOR' ? undefined : user.sub;
    return this.reportsService.listReports(pagination.page, pagination.limit, requestedBy);
  }

  @Get(':id')
  @ApiOperation({ summary: "Consulter l'état d'un rapport généré" })
  @ApiParam({ name: 'id', description: 'UUID du rapport' })
  @ApiResponse({ status: 200, description: 'État du rapport.' })
  @ApiResponse({ status: 403, description: "Le superviseur n'est pas propriétaire du rapport." })
  async getReport(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.reportDownload.accessibleReport(id, user);
  }

  @Get(':id/download')
  @Roles('ADMINISTRATOR', 'SUPERVISOR')
  @ApiOperation({
    summary: 'Telecharger le PDF d un rapport genere',
    description:
      'Telecharge le fichier PDF du rapport s il est prêt.\n\n**Rôles autorises :** ADMINISTRATOR ou le SUPERVISOR ayant demande le rapport',
  })
  @ApiParam({ name: 'id', description: 'UUID du rapport' })
  @ApiResponse({ status: 200, description: 'Fichier PDF retourne avec succes.' })
  @ApiResponse({ status: 400, description: 'Rapport non prêt ou echoue.' })
  @ApiResponse({ status: 403, description: 'Acces refuse.' })
  @ApiResponse({ status: 404, description: 'Rapport ou fichier introuvable.' })
  async downloadReport(@Param('id') id: string, @CurrentUser() user: JwtPayload, @Res() res: Response) {
    const { filePath, filename } = await this.reportDownload.resolve(id, user);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    const { createReadStream } = await import('fs');
    const stream = createReadStream(filePath);
    stream.on('error', (err) => {
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Erreur de lecture.' } });
      }
      stream.destroy(err);
    });
    stream.pipe(res);
  }
}
