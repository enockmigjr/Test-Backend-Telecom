import { Injectable } from '@nestjs/common';

/**
 * Configuration Redis.
 */
@Injectable()
export class RedisConfigService {
  get host(): string {
    return process.env['REDIS_HOST'] || 'localhost';
  }

  get port(): number {
    return parseInt(process.env['REDIS_PORT'] || '6379', 10);
  }

  get password(): string | undefined {
    return process.env['REDIS_PASSWORD'] || undefined;
  }

  get url(): string {
    return process.env['REDIS_URL'] || `redis://${this.host}:${this.port}`;
  }
}
