/**
 * ============================================================================
 * FICHIER : src/modules/reports/report-download.service.ts
 * RÔLE : Service de résolution et de sécurisation de l'accès aux fichiers PDF des rapports.
 * EXPLICATION :
 * Ce service contrôle l'accès physique aux rapports générés sur le disque local :
 * 1. `accessibleReport` : Vérifie les privilèges d'accès (seul l'initiateur du rapport ou un `ADMINISTRATOR` peut accéder à un rapport donné).
 * 2. `resolve` & `resolveSigned` : Valident le rapport pour un utilisateur authentifié ou un lien signé HMAC.
 * 3. `resolveFile` : S'assure que le statut est `completed`, applique un contrôle strict contre la traversée de répertoire (`Path Traversal`) et confirme l'existence physique du fichier PDF sur le stockage.
 * ============================================================================
 */

import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { existsSync } from 'fs';
import { resolve, sep } from 'path';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { ReportsService } from './reports.service';
import { ReportDownloadLinkService } from './report-download-link.service';

/**
 * Service gérant la vérification des droits et le chemin d'accès aux fichiers PDF de rapports.
 */
@Injectable()
export class ReportDownloadService {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly downloadLinks: ReportDownloadLinkService,
  ) {}

  /**
   * Valide les autorisations d'accès à un rapport pour un utilisateur donné.
   *
   * @param id UUID du rapport.
   * @param user Utilisateur courant.
   * @param action Libellé de l'action pour le message d'erreur.
   * @throws ForbiddenException si l'utilisateur n'est ni le créateur du rapport ni administrateur.
   */
  async accessibleReport(id: string, user: JwtPayload, action = 'consulter') {
    const report = await this.reportsService.getReport(id);
    if (user.role !== 'ADMINISTRATOR' && report.requestedBy !== user.sub) {
      throw new ForbiddenException(`Vous n'avez pas l'autorisation de ${action} ce rapport.`);
    }
    return report;
  }

  /**
   * Résout le chemin physique d'un rapport pour un utilisateur authentifié.
   *
   * @param id UUID du rapport.
   * @param user Utilisateur authentifié.
   */
  async resolve(id: string, user: JwtPayload) {
    const report = await this.accessibleReport(id, user, 'télécharger');
    return this.resolveFile(report);
  }

  /**
   * Résout le fichier PDF via vérification d'un lien signé HMAC.
   *
   * @param id UUID du rapport.
   * @param expires Timestamp d'expiration.
   * @param signature Signature HMAC SHA-256 base64url.
   */
  async resolveSigned(id: string, expires: number, signature: string) {
    this.downloadLinks.verify(id, expires, signature);
    const report = await this.reportsService.getReport(id);
    return this.resolveFile(report);
  }

  /**
   * Vérifie la présence physique et la sécurité du chemin d'accès du fichier PDF.
   */
  private resolveFile(report: Awaited<ReturnType<ReportsService['getReport']>>) {
    if (report.status !== 'completed' || !report.objectKey) {
      throw new BadRequestException("Le rapport n'est pas encore prêt ou a échoué.");
    }
    const storageRoot = resolve(process.env['STORAGE_LOCAL_PATH'] || './uploads');
    const filePath = resolve(storageRoot, report.objectKey);
    if (!filePath.startsWith(`${storageRoot}${sep}`)) {
      throw new ForbiddenException('Chemin de rapport invalide.');
    }
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    if (!existsSync(filePath)) throw new NotFoundException('Le fichier physique du rapport est introuvable.');
    return { filePath, filename: `Rapport-${report.type}-${report.id}.pdf` };
  }
}
