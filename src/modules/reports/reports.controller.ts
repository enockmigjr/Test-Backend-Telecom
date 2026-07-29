/**
 * ============================================================================
 * FICHIER : src/modules/reports/reports.controller.ts
 * RÔLE : Contrôleur REST d'administration et de génération des rapports d'activité.
 * EXPLICATION :
 * Ce contrôleur propose deux modes d'extraction des rapports d'incidents et de conformité SLA (`/api/v1/reports`) :
 * 1. Synchrones (JSON) : `GET /ticket/:id`, `GET /sla` pour la consultation directe en tableau de bord.
 * 2. Asynchrones (PDF via BullMQ) : `POST /ticket/:id/generate`, `POST /sla/generate`, `POST /weekly/generate`. Répond HTTP 202 Accepted et délègue la compilation PDF/PDFKit au worker asynchrone.
 * 3. Gestion des fichiers : `GET /`, `GET /:id`, `GET /:id/download` pour l'historique et le téléchargement des rapports au format PDF.
 * ============================================================================
 */

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

/**
 * Contrôleur d'API pour la génération et le téléchargement des rapports décisionnels.
 */
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

  /**
   * Extrait les données brutes d'un ticket au format JSON pour affichage direct.
   *
   * @param id UUID du ticket.
   * @param user Utilisateur courant.
   */
  @Get('ticket/:id')
  @ApiOperation({
    summary: 'Obtenir les données du rapport d un ticket (synchrone — données JSON)',
    description: 'Retourne les détails du ticket sous format JSON.\n\n**Rôles autorisés :** ADMINISTRATOR, SUPERVISOR',
  })
  @ApiParam({ name: 'id', description: 'UUID du ticket' })
  @ApiResponse({ status: 200, description: 'Données du rapport retournées.' })
  @ApiResponse({ status: 404, description: 'Ticket non trouvé.' })
  async getTicketReport(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.reportsService.ticketReport(id, user);
  }

  /**
   * Enfile une demande de génération de rapport PDF détaillé pour un ticket (asynchrone).
   *
   * @param id UUID du ticket.
   * @param user Demandeur de la génération.
   */
  @Post('ticket/:id/generate')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Générer un rapport PDF détaillé pour un ticket (asynchrone)',
    description:
      'Lance la génération en arrière-plan du rapport PDF.\n\n**Rôles autorisés :** ADMINISTRATOR, SUPERVISOR',
  })
  @ApiParam({ name: 'id', description: 'UUID du ticket' })
  @ApiResponse({ status: 202, description: 'Rapport en cours de génération.' })
  async ticketReport(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    // Vérification préalable de la visibilité et de l'existence du ticket
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
      message: 'Rapport en cours de génération. Vous recevrez une notification.',
      reportId,
    };
  }

  /**
   * Extrait les métriques SLA de la période au format JSON pour affichage direct.
   *
   * @param range Plage de dates du rapport.
   * @param user Utilisateur authentifié.
   */
  @Get('sla')
  @ApiOperation({
    summary: 'Rapport SLA sur une période (synchrone — données JSON)',
    description: 'Retourne les métriques SLA au format JSON.\n\n**Rôles autorisés :** ADMINISTRATOR, SUPERVISOR',
  })
  @ApiResponse({ status: 200, description: 'Métriques SLA.' })
  async slaReport(@Query() range: DateRangeDto, @CurrentUser() user: JwtPayload) {
    const departmentId = user.role === 'ADMINISTRATOR' ? undefined : user.departmentId;
    return this.reportsService.slaReport(range.from, range.to, departmentId);
  }

  /**
   * Enfile une demande de génération de rapport SLA au format PDF.
   *
   * @param range Dates de début et de fin de la période d'analyse.
   * @param user Utilisateur authentifié.
   */
  @Post('sla/generate')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Générer un rapport SLA PDF (asynchrone)',
    description:
      'Lance la génération en arrière-plan du rapport SLA PDF.\n\n**Rôles autorisés :** ADMINISTRATOR, SUPERVISOR',
  })
  @ApiResponse({ status: 202, description: 'Rapport SLA en cours de génération.' })
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
      message: 'Rapport SLA en cours de génération. Vous recevrez une notification.',
      reportId,
    };
  }

  /**
   * Lance manuellement la génération d'un rapport hebdomadaire PDF.
   *
   * @param user Administrateur demandeur.
   */
  @Post('weekly/generate')
  @Roles('ADMINISTRATOR')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Générer un rapport hebdomadaire PDF (asynchrone)',
    description:
      'Lance la génération en arrière-plan du rapport hebdomadaire PDF.\n\n**Rôles autorisés :** ADMINISTRATOR uniquement',
  })
  @ApiResponse({ status: 202, description: 'Rapport hebdomadaire en cours de génération.' })
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
      message: 'Rapport hebdomadaire en cours de génération. Vous recevrez une notification.',
      reportId,
    };
  }

  /**
   * Extrait la liste paginée des rapports d'activité générés.
   *
   * @param pagination Objet de pagination.
   * @param user Utilisateur connecté (les superviseurs ne voient que leurs propres rapports).
   */
  @Get()
  @ApiOperation({
    summary: 'Lister les rapports générés',
    description:
      'Retourne tous les rapports pour un administrateur et uniquement ses propres rapports pour un superviseur.',
  })
  @ApiResponse({ status: 200, description: 'Liste des rapports.' })
  @ApiResponse({ status: 403, description: 'Accès refusé (rôle insuffisant).' })
  async listReports(@Query() pagination: PaginationDto, @CurrentUser() user: JwtPayload) {
    const requestedBy = user.role === 'ADMINISTRATOR' ? undefined : user.sub;
    return this.reportsService.listReports(pagination.page, pagination.limit, requestedBy);
  }

  /**
   * Consulte le statut et les métadonnées d'un rapport.
   *
   * @param id UUID du rapport.
   * @param user Utilisateur courant.
   */
  @Get(':id')
  @ApiOperation({ summary: "Consulter l'état d'un rapport généré" })
  @ApiParam({ name: 'id', description: 'UUID du rapport' })
  @ApiResponse({ status: 200, description: 'État du rapport.' })
  @ApiResponse({ status: 403, description: "Le superviseur n'est pas propriétaire du rapport." })
  async getReport(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.reportDownload.accessibleReport(id, user);
  }

  /**
   * Télécharge directement le fichier PDF d'un rapport terminé.
   *
   * @param id UUID du rapport.
   * @param user Utilisateur authentifié autorise.
   * @param res Objet de réponse Express pour le flux PDF.
   */
  @Get(':id/download')
  @Roles('ADMINISTRATOR', 'SUPERVISOR')
  @ApiOperation({
    summary: 'Télécharger le PDF d un rapport généré',
    description:
      'Télécharge le fichier PDF du rapport s il est prêt.\n\n**Rôles autorisés :** ADMINISTRATOR ou le SUPERVISOR ayant demandé le rapport',
  })
  @ApiParam({ name: 'id', description: 'UUID du rapport' })
  @ApiResponse({ status: 200, description: 'Fichier PDF retourné avec succès.' })
  @ApiResponse({ status: 400, description: 'Rapport non prêt ou échoué.' })
  @ApiResponse({ status: 403, description: 'Accès refusé.' })
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
