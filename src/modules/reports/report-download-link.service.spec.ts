/**
 * ============================================================================
 * FICHIER : src/modules/reports/report-download-link.service.spec.ts
 * RÔLE : Suite de tests unitaires pour le composant report-download-link.service.
 * EXPLICATION :
 * Ce fichier contient les tests automatisés validant le comportement et l'intégrité de report-download-link.service.
 * 1. Vérifie le fonctionnement nominal et les cas d'erreur.
 * 2. Garantit qu'aucune régression n'est introduite lors des évolutions du code.
 * ============================================================================
 */

import { ForbiddenException, GoneException } from '@nestjs/common';
import { ReportDownloadLinkService } from './report-download-link.service';

describe('ReportDownloadLinkService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      NODE_ENV: 'test',
      API_PUBLIC_URL: 'https://api.example.test',
      REPORT_DOWNLOAD_SECRET: 'a-secure-report-download-secret-for-tests',
      REPORT_DOWNLOAD_TTL_SECONDS: '3600',
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  /** Test : crée un lien temporaire vérifiable pour un rapport précis */

  it('crée un lien temporaire vérifiable pour un rapport précis', () => {
    const service = new ReportDownloadLinkService();
    const url = new URL(service.createUrl('report-123'));
    const expires = Number(url.searchParams.get('expires'));
    const signature = url.searchParams.get('signature') ?? '';

    expect(url.pathname).toBe('/api/v1/reports/public/report-123/download');
    expect(() => service.verify('report-123', expires, signature)).not.toThrow();
  });

  /** Test : refuse une signature modifiée et un lien expiré */

  it('refuse une signature modifiée et un lien expiré', () => {
    const service = new ReportDownloadLinkService();
    const url = new URL(service.createUrl('report-123'));
    const expires = Number(url.searchParams.get('expires'));
    const signature = url.searchParams.get('signature') ?? '';

    expect(() => service.verify('report-456', expires, signature)).toThrow(ForbiddenException);
    expect(() => service.verify('report-123', 1, signature)).toThrow(GoneException);
  });
});
