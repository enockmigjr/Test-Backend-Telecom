/**
 * ============================================================================
 * FICHIER : src/modules/reports/report-download-link.service.ts
 * RÔLE : Service de génération et de vérification des liens de téléchargement signés (HMAC SHA-256).
 * EXPLICATION :
 * Ce service sécurise l'accès public aux rapports PDF générés sans compromettre l'authentification :
 * 1. `createUrl` : Construit une URL de téléchargement temporaire (TTL 7 jours par défaut) incluant un timestamp d'expiration et un jeton HMAC SHA-256 `base64url`.
 * 2. `verify` : Vérifie que le lien n'est pas expiré (`GoneException`) et compare la signature transmise avec l'empreinte attendue en utilisant `crypto.timingSafeEqual` pour immuniser contre les attaques par canal auxiliaire (Timing Attacks).
 * 3. `secret` : Valide la présence d'une clé secrète d'au moins 32 caractères en environnement de production.
 * ============================================================================
 */

import { ForbiddenException, GoneException, Injectable } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';

const DEFAULT_TTL_SECONDS = 2 * 24 * 60 * 60;
const DEVELOPMENT_SECRET = 'development-report-download-secret-change-me';

/**
 * Service cryptographique de signature et vérification d'URLs pour le téléchargement de rapports.
 */
@Injectable()
export class ReportDownloadLinkService {
  /**
   * Génère une URL signée et horodatée pour le téléchargement d'un rapport PDF.
   *
   * @param reportId Identifiant unique UUIDv7 du rapport.
   * @returns L'URL complète signée prête à être envoyée par e-mail.
   */
  createUrl(reportId: string): string {
    const expires = Math.floor(Date.now() / 1000) + this.ttlSeconds;
    const signature = this.sign(reportId, expires);
    const baseUrl = process.env['API_PUBLIC_URL'] || process.env['APP_URL'] || 'http://localhost:3000';
    const url = new URL(`/api/v1/reports/public/${reportId}/download`, baseUrl);
    url.searchParams.set('expires', String(expires));
    url.searchParams.set('signature', signature);
    return url.toString();
  }

  /**
   * Valide l'intégrité et la validité temporelle d'un lien de téléchargement signé.
   *
   * @param reportId Identifiant du rapport.
   * @param expires Date d'expiration UNIX en secondes.
   * @param signature Signature HMAC transmise.
   * @throws GoneException si le lien a expiré.
   * @throws ForbiddenException si la signature est falsifiée ou invalide.
   */
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

  /**
   * Signe l'empreinte de la ressource et de son expiration par HMAC SHA-256.
   */
  private sign(reportId: string, expires: number): string {
    return createHmac('sha256', this.secret).update(`report-download:v1:${reportId}:${expires}`).digest('base64url');
  }

  /**
   * Durée de validité en secondes configurée.
   */
  private get ttlSeconds(): number {
    const value = Number(process.env['REPORT_DOWNLOAD_TTL_SECONDS'] || DEFAULT_TTL_SECONDS);
    return Number.isInteger(value) && value > 0 ? value : DEFAULT_TTL_SECONDS;
  }

  /**
   * Clé secrète de signature HMAC (exige au moins 32 caractères en production).
   */
  private get secret(): string {
    const value = process.env['REPORT_DOWNLOAD_SECRET'];
    if (!value || value.length < 32) {
      if (process.env['NODE_ENV'] === 'production') {
        throw new Error('REPORT_DOWNLOAD_SECRET doit contenir au moins 32 caractères en production.');
      }
      if (!value) {
        // Hors prod sans secret configuré : on refuse de signer plutôt que d'utiliser un fallback forgeable
        throw new Error('REPORT_DOWNLOAD_SECRET manquant (32+ caractères requis).');
      }
    }
    return value ?? DEVELOPMENT_SECRET;
  }
}
