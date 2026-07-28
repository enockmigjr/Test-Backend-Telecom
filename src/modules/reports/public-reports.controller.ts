import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiProduces, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { SignedReportDownloadQueryDto } from './dto/signed-report-download-query.dto';
import { ReportDownloadService } from './report-download.service';

@ApiTags('reports')
@Controller('reports/public')
export class PublicReportsController {
  constructor(private readonly reportDownload: ReportDownloadService) {}

  @Public()
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
