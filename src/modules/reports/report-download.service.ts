import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { existsSync } from 'fs';
import { resolve, sep } from 'path';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { ReportsService } from './reports.service';
import { ReportDownloadLinkService } from './report-download-link.service';

@Injectable()
export class ReportDownloadService {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly downloadLinks: ReportDownloadLinkService,
  ) {}

  async accessibleReport(id: string, user: JwtPayload, action = 'consulter') {
    const report = await this.reportsService.getReport(id);
    if (user.role !== 'ADMINISTRATOR' && report.requestedBy !== user.sub) {
      throw new ForbiddenException(`Vous n'avez pas l'autorisation de ${action} ce rapport.`);
    }
    return report;
  }

  async resolve(id: string, user: JwtPayload) {
    const report = await this.accessibleReport(id, user, 'telecharger');
    return this.resolveFile(report);
  }

  async resolveSigned(id: string, expires: number, signature: string) {
    this.downloadLinks.verify(id, expires, signature);
    const report = await this.reportsService.getReport(id);
    return this.resolveFile(report);
  }

  private resolveFile(report: Awaited<ReturnType<ReportsService['getReport']>>) {
    if (report.status !== 'completed' || !report.objectKey) {
      throw new BadRequestException("Le rapport n'est pas encore prêt ou a echoue.");
    }
    const storageRoot = resolve(process.env['STORAGE_LOCAL_PATH'] || './uploads');
    const filePath = resolve(storageRoot, report.objectKey);
    if (!filePath.startsWith(`${storageRoot}${sep}`)) {
      throw new ForbiddenException('Chemin de rapport invalide.');
    }
    // Le chemin est normalisé et borné au répertoire de stockage ci-dessus.
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    if (!existsSync(filePath)) throw new NotFoundException('Le fichier physique du rapport est introuvable.');
    return { filePath, filename: `Rapport-${report.type}-${report.id}.pdf` };
  }
}
