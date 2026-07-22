import { Injectable } from '@nestjs/common';

/**
 * Configuration JWT.
 */
@Injectable()
export class JwtConfigService {
  get accessSecret(): string {
    return this.getSecret('JWT_ACCESS_SECRET', 'dev-access-secret-change-in-production');
  }

  get refreshSecret(): string {
    return this.getSecret('JWT_REFRESH_SECRET', 'dev-refresh-secret-change-in-production');
  }

  get accessExpiration(): string {
    return process.env['JWT_ACCESS_EXPIRATION'] || '15m';
  }

  get refreshExpiration(): string {
    return process.env['JWT_REFRESH_EXPIRATION'] || '7d';
  }

  /**
   * Durée de vie de l'access token en secondes (pour le TTL Redis de la blacklist).
   * Supporte les formats : '15m', '1h', '30s', '1d'.
   */
  get accessExpirationSeconds(): number {
    return this.parseDuration(this.accessExpiration, 900);
  }

  get refreshExpirationSeconds(): number {
    return this.parseDuration(this.refreshExpiration, 604800);
  }

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

  private parseDuration(raw: string, fallback: number): number {
    const match = raw.match(/^(\d+)([smhd])$/);
    if (!match) return fallback;
    const value = parseInt(match[1], 10);
    const unit = match[2];
    const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
    return value * (multipliers[unit] ?? 60);
  }
}
