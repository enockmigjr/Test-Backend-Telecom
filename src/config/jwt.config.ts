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
}
