import { ForbiddenException, GoneException, Injectable } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';

const DEFAULT_TTL_SECONDS = 7 * 24 * 60 * 60;
const DEVELOPMENT_SECRET = 'development-report-download-secret-change-me';

@Injectable()
export class ReportDownloadLinkService {
  createUrl(reportId: string): string {
    const expires = Math.floor(Date.now() / 1000) + this.ttlSeconds;
    const signature = this.sign(reportId, expires);
    const baseUrl = process.env['API_PUBLIC_URL'] || process.env['APP_URL'] || 'http://localhost:3000';
    const url = new URL(`/api/v1/reports/public/${reportId}/download`, baseUrl);
    url.searchParams.set('expires', String(expires));
    url.searchParams.set('signature', signature);
    return url.toString();
  }

  verify(reportId: string, expires: number, signature: string): void {
    if (expires <= Math.floor(Date.now() / 1000)) {
      throw new GoneException('Ce lien de téléchargement a expiré.');
    }
    const expected = Buffer.from(this.sign(reportId, expires));
    const received = Buffer.from(signature);
    if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
      throw new ForbiddenException('Lien de téléchargement invalide.');
    }
  }

  private sign(reportId: string, expires: number): string {
    return createHmac('sha256', this.secret).update(`report-download:v1:${reportId}:${expires}`).digest('base64url');
  }

  private get ttlSeconds(): number {
    const value = Number(process.env['REPORT_DOWNLOAD_TTL_SECONDS'] || DEFAULT_TTL_SECONDS);
    return Number.isInteger(value) && value > 0 ? value : DEFAULT_TTL_SECONDS;
  }

  private get secret(): string {
    const value = process.env['REPORT_DOWNLOAD_SECRET'];
    if (process.env['NODE_ENV'] === 'production' && (!value || value.length < 32)) {
      throw new Error('REPORT_DOWNLOAD_SECRET doit contenir au moins 32 caractères en production.');
    }
    return value || DEVELOPMENT_SECRET;
  }
}
