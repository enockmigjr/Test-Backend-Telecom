import { Injectable } from '@nestjs/common';

/**
 * Configuration de la base de données PostgreSQL.
 */
@Injectable()
export class DatabaseConfigService {
  get host(): string {
    return process.env['DATABASE_HOST'] || 'localhost';
  }

  get port(): number {
    return parseInt(process.env['DATABASE_PORT'] || '5432', 10);
  }

  get user(): string {
    return process.env['DATABASE_USER'] || 'telecom';
  }

  get password(): string {
    return process.env['DATABASE_PASSWORD'] || 'telecom_secret';
  }

  get database(): string {
    return process.env['DATABASE_NAME'] || 'telecom_tickets';
  }

  get url(): string {
    return (
      process.env['DATABASE_URL'] ||
      `postgresql://${this.user}:${this.password}@${this.host}:${this.port}/${this.database}`
    );
  }

  get maxConnections(): number {
    return parseInt(process.env['DATABASE_MAX_CONNECTIONS'] || '20', 10);
  }
}
