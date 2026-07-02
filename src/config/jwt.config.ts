import { Injectable } from '@nestjs/common';

/**
 * Configuration JWT.
 */
@Injectable()
export class JwtConfigService {
  get accessSecret(): string {
    return process.env['JWT_ACCESS_SECRET'] || 'dev-access-secret-change-in-production';
  }

  get refreshSecret(): string {
    return process.env['JWT_REFRESH_SECRET'] || 'dev-refresh-secret-change-in-production';
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
    const raw = this.accessExpiration;
    const match = raw.match(/^(\d+)([smhd])$/);
    if (!match) return 900; // fallback 15 min
    const value = parseInt(match[1], 10);
    const unit = match[2];
    const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
    return value * (multipliers[unit] ?? 60);
  }
}
