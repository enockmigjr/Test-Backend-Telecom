/**
 * ============================================================================
 * FICHIER : src/config/jwt.config.ts
 * RÔLE : Configuration et gestion des jetons de sécurité JWT (JSON Web Tokens).
 * EXPLICATION :
 * Les jetons JWT sont comme des "badges d'accès numériques".
 * Quand un utilisateur se connecte, l'API lui délivre :
 * 1. Un "Access Token" (durée courte, ex: 15 min) pour accéder aux données.
 * 2. Un "Refresh Token" (durée longue, ex: 7 jours) pour renouveler le badge sans retaper le mot de passe.
 * Ce fichier vérifie la sécurité des clés secrètes servant à signer ces badges.
 * ============================================================================
 */

import { Injectable } from '@nestjs/common';

/**
 * Service JwtConfigService
 * Centralise les paramètres de génération et de validation des jetons JWT.
 */
@Injectable()
export class JwtConfigService {
  /**
   * Clé secrète de signature pour les jetons d'accès courts (Access Tokens).
   */
  /** Getter `accessSecret` : Récupère la valeur de configuration correspondante. */
  get accessSecret(): string {
    return this.getSecret('JWT_ACCESS_SECRET', 'dev-access-secret-change-in-production');
  }

  /**
   * Clé secrète de signature pour les jetons de rafraîchissement longs (Refresh Tokens).
   */
  /** Getter `refreshSecret` : Récupère la valeur de configuration correspondante. */
  get refreshSecret(): string {
    return this.getSecret('JWT_REFRESH_SECRET', 'dev-refresh-secret-change-in-production');
  }

  /**
   * Durée de validité de l'access token exprimée sous forme de texte (ex: "15m" pour 15 minutes).
   */
  /** Getter `accessExpiration` : Récupère la valeur de configuration correspondante. */
  get accessExpiration(): string {
    return process.env['JWT_ACCESS_EXPIRATION'] || '15m';
  }

  /**
   * Durée de validité du refresh token exprimée sous forme de texte (ex: "7d" pour 7 jours).
   */
  /** Getter `refreshExpiration` : Récupère la valeur de configuration correspondante. */
  get refreshExpiration(): string {
    return process.env['JWT_REFRESH_EXPIRATION'] || '7d';
  }

  /**
   * Durée de vie de l'access token convertie en secondes (utilisée pour purger Redis).
   */
  /** Getter `accessExpirationSeconds` : Récupère la valeur de configuration correspondante. */
  get accessExpirationSeconds(): number {
    return this.parseDuration(this.accessExpiration, 900);
  }

  /**
   * Durée de vie du refresh token convertie en secondes (utilisée pour purger Redis).
   */
  /** Getter `refreshExpirationSeconds` : Récupère la valeur de configuration correspondante. */
  get refreshExpirationSeconds(): number {
    return this.parseDuration(this.refreshExpiration, 604800);
  }

  /**
   * Méthode privée vérifiant qu'en production la clé secrète fait au moins 32 caractères.
   */
  private getSecret(name: 'JWT_ACCESS_SECRET' | 'JWT_REFRESH_SECRET', developmentFallback: string): string {
    const value = process.env[name];
    if (process.env['NODE_ENV'] === 'production') {
      const exampleValue =
        name === 'JWT_ACCESS_SECRET' ? 'change-me-access-secret-min-32-chars' : 'change-me-refresh-secret-min-32-chars';
      if (!value || value.length < 32 || value === developmentFallback || value === exampleValue) {
        throw new Error(`${name} doit etre un secret explicite d'au moins 32 caracteres en production.`);
      }
    }
    return value || developmentFallback;
  }

  /**
   * Méthode privée permettant de convertir une durée sous forme de texte ("15m", "1h", "7d") en nombre total de secondes.
   */
  private parseDuration(raw: string, fallback: number): number {
    const match = raw.match(/^(\d+)([smhd])$/);
    if (!match) return fallback;
    const value = parseInt(match[1], 10);
    const unit = match[2];
    const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
    return value * (multipliers[unit] ?? 60);
  }
}
