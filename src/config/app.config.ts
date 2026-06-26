import { Injectable } from '@nestjs/common';

/**
 * Service de configuration centralisée de l'application.
 * Expose les variables d'environnement validées de manière typée.
 */
@Injectable()
export class AppConfigService {
  get port(): number {
    return parseInt(process.env['PORT'] || '3000', 10);
  }

  get apiPrefix(): string {
    return process.env['API_PREFIX'] || 'api/v1';
  }

  get isDev(): boolean {
    return (process.env['NODE_ENV'] || 'development') === 'development';
  }

  get isProd(): boolean {
    return process.env['NODE_ENV'] === 'production';
  }

  get logLevel(): string {
    return process.env['LOG_LEVEL'] || (this.isDev ? 'debug' : 'info');
  }

  get corsOrigin(): string {
    return process.env['CORS_ORIGIN'] || 'http://localhost:5173,http://localhost:3000';
  }

  get throttleTtl(): number {
    return parseInt(process.env['THROTTLE_TTL'] || '900000', 10);
  }

  get throttleLimit(): number {
    return parseInt(process.env['THROTTLE_LIMIT'] || '100', 10);
  }

  get throttleAuthTtl(): number {
    return parseInt(process.env['THROTTLE_AUTH_TTL'] || '3600000', 10);
  }

  get throttleAuthLimit(): number {
    return parseInt(process.env['THROTTLE_AUTH_LIMIT'] || '10', 10);
  }
}
