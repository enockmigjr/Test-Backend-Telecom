/**
 * ============================================================================
 * FICHIER : src/modules/reports/public-reports.controller.ts
 * RÔLE : Contrôleur REST d'accès public aux rapports PDF générés via liens signés cryptographiquement.
 * EXPLICATION :
 * Ce contrôleur permet le téléchargement direct d'un rapport PDF depuis un lien envoyé par email (`/reports/public/:id/download`) :
 * 1. `@Public()` : Permet l'accès sans en-tête Authorization JWT.
 * 2. Contrôle de signature : Valide l'empreinte HMAC SHA-256 et la date d'expiration (`query.expires`, `query.signature`).
 * 3. Sécurité HTTP : Injecte les en-têtes de sécurité (`Cache-Control: private, no-store`, `X-Robots-Tag: noindex, nofollow`, `Content-Type: application/pdf`).
 * 4. Streaming réactif : Utilise un flux de lecture (`fs.createReadStream`) pour transmettre le fichier PDF sans bloquer l'Event Loop NestJS.
 * ============================================================================
 */

import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiProduces, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { Auth, AuthMode } from '../../common/decorators/auth-mode.decorator';
import { SignedReportDownloadQueryDto } from './dto/signed-report-download-query.dto';
import { ReportDownloadService } from './report-download.service';

/**
 * Contrôleur d'API pour les téléchargements de rapports PDF sécurisés par signature HMAC.
 */
@ApiTags('reports')
@Controller('reports/public')
export class PublicReportsController {
  constructor(private readonly reportDownload: ReportDownloadService) {}

  /**
   * Télécharge un rapport PDF généré via une URL signée et temporaire.
   *
   * @param id UUIDv7 du rapport.
   * @param query DTO contenant le timestamp d'expiration et la signature HMAC SHA-256 base64url.
   * @param response Objet de réponse Express.
   */
  @Auth(AuthMode.ANONYMOUS)
  @Get(':id/download')
  @ApiOperation({ summary: 'Télécharger un rapport depuis un lien signé et temporaire' })
  @ApiParam({ name: 'id', description: 'UUID du rapport' })
  @ApiProduces('application/pdf')
  @ApiResponse({ status: 200, description: 'Fichier PDF.' })
  @ApiResponse({ status: 403, description: 'Signature invalide.' })
  @ApiResponse({ status: 410, description: 'Lien expiré.' })
  async download(
    @Param('id') id: string,
    @Query() query: SignedReportDownloadQueryDto,
    @Res() response: Response,
  ): Promise<void> {
    const { filePath, filename } = await this.reportDownload.resolveSigned(id, query.expires, query.signature);
    response.setHeader('Content-Type', 'application/pdf');
    response.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    response.setHeader('Cache-Control', 'private, no-store');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
    response.setHeader('X-Content-Type-Options', 'nosniff');

    const { createReadStream } = await import('fs');
    const stream = createReadStream(filePath);
    stream.on('error', (error) => {
      if (!response.headersSent) response.status(500).end();
      stream.destroy(error);
    });
    stream.pipe(response);
  }
}
