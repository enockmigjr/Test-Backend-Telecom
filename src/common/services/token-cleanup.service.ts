import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { lte } from 'drizzle-orm';
import { DrizzleProvider } from '../../database/drizzle.provider';
import { refreshTokens } from '../../database/schemas';

/**
 * Service de nettoyage des tokens expirés.
 *
 * Exécuté quotidiennement à 3h du matin pour supprimer les refresh_tokens
 * qui ont dépassé leur date d'expiration (évite l'accumulation inutile).
 *
 * Les tokens révoqués (revokedAt NOT NULL) sont également nettoyés
 * après 30 jours.
 */
@Injectable()
export class TokenCleanupService {
  private readonly logger = new Logger(TokenCleanupService.name);

  /** Rétention des tokens révoqués : 30 jours (pour audit trail) */
  private static readonly REVOKED_RETENTION_DAYS = 30;

  constructor(private readonly drizzle: DrizzleProvider) {}

  /**
   * Cron quotidien — exécuté à 3h00 du matin.
   */
  @Cron('0 3 * * *')
  async cleanExpiredTokens(): Promise<void> {
    const now = new Date();
    const revokedCutoff = new Date(now.getTime() - TokenCleanupService.REVOKED_RETENTION_DAYS * 24 * 60 * 60 * 1000);

    try {
      // 1. Supprimer les tokens expirés
      const expiredResult = await this.drizzle.db
        .delete(refreshTokens)
        .where(lte(refreshTokens.expiresAt, now))
        .returning({ id: refreshTokens.id });

      // 2. Supprimer les tokens révoqués depuis plus de 30 jours
      const revokedResult = await this.drizzle.db
        .delete(refreshTokens)
        .where(lte(refreshTokens.revokedAt, revokedCutoff))
        .returning({ id: refreshTokens.id });

      const expiredCount = expiredResult.length;
      const revokedCount = revokedResult.length;

      if (expiredCount + revokedCount > 0) {
        this.logger.log(`Nettoyage tokens: ${expiredCount} expirés + ${revokedCount} révoqués (>30j) supprimés`);
      }
    } catch (err) {
      this.logger.error(`Échec du nettoyage des tokens: ${(err as Error).message}`);
    }
  }

  /**
   * Méthode manuelle — utile pour les tests ou le nettoyage immédiat.
   */
  async cleanNow(): Promise<{ expired: number; revoked: number }> {
    const now = new Date();
    const revokedCutoff = new Date(now.getTime() - TokenCleanupService.REVOKED_RETENTION_DAYS * 24 * 60 * 60 * 1000);

    const expiredResult = await this.drizzle.db
      .delete(refreshTokens)
      .where(lte(refreshTokens.expiresAt, now))
      .returning({ id: refreshTokens.id });

    const revokedResult = await this.drizzle.db
      .delete(refreshTokens)
      .where(lte(refreshTokens.revokedAt, revokedCutoff))
      .returning({ id: refreshTokens.id });

    return {
      expired: expiredResult.length,
      revoked: revokedResult.length,
    };
  }
}
