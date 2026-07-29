/**
 * ============================================================================
 * FICHIER : src/common/services/token-cleanup.service.ts
 * RÔLE : Service de nettoyage périodique et automatique des jetons de rafraîchissement (Refresh Tokens).
 * EXPLICATION :
 * Ce service évite l'accumulation indéfinie de lignes obsolètes dans la table PostgreSQL `refresh_tokens` :
 * 1. Supprime quotidiennement à 3h00 du matin (`@Cron('0 3 * * *')`) tous les jetons ayant dépassé leur date d'expiration (`expiresAt <= NOW`).
 * 2. Conserve les jetons révoqués (`revokedAt NOT NULL`) pendant 30 jours à des fins d'analyse de sécurité avant de les purger définitivement.
 * 3. Propose une méthode `cleanNow()` pour déclencher manuellement la purge lors de tests E2E ou d'opérations de maintenance.
 * ============================================================================
 */

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
 * Service gérant le cycle de vie et la purge des jetons de rafraîchissement expirés.
 */
@Injectable()
export class TokenCleanupService {
  private readonly logger = new Logger(TokenCleanupService.name);

  /** Rétention maximale des jetons révoqués : 30 jours (pour traçabilité de sécurité). */
  private static readonly REVOKED_RETENTION_DAYS = 30;

  constructor(private readonly drizzle: DrizzleProvider) {}

  /**
   * Tâche Cron planifiée — s'exécute chaque nuit à 03h00 du matin.
   */
  @Cron('0 3 * * *')
  async cleanExpiredTokens(): Promise<void> {
    const now = new Date();
    const revokedCutoff = new Date(now.getTime() - TokenCleanupService.REVOKED_RETENTION_DAYS * 24 * 60 * 60 * 1000);

    try {
      // 1. Purger les jetons dont la date d'expiration est atteinte
      const expiredResult = await this.drizzle.db
        .delete(refreshTokens)
        .where(lte(refreshTokens.expiresAt, now))
        .returning({ id: refreshTokens.id });

      // 2. Purger les jetons révoqués depuis plus de 30 jours
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
   * Exécute immédiatement la purge de la base sans attendre l'heure du Cron.
   *
   * @returns Le nombre de jetons expirés et révoqués effectivement supprimés.
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
