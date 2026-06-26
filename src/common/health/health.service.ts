import { Injectable, Logger } from '@nestjs/common';
import { DrizzleProvider } from '../../database/drizzle.provider';
import { sql } from 'drizzle-orm';
import { Redis } from 'ioredis';
import { redisConfig } from '../providers/redis.config';

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(private readonly drizzle: DrizzleProvider) {}

  async check(): Promise<Record<string, { status: string; message?: string }>> {
    const results: Record<string, { status: string; message?: string }> = {};

    // PostgreSQL
    try {
      await this.drizzle.db.execute(sql`SELECT 1`);
      results['postgresql'] = { status: 'ok' };
    } catch (error) {
      results['postgresql'] = { status: 'error', message: (error as Error).message };
    }

    // Redis
    try {
      const redis = new Redis({
        host: redisConfig.host,
        port: redisConfig.port,
        password: redisConfig.password || undefined,
        connectTimeout: 3000,
        maxRetriesPerRequest: 1,
      });
      await redis.ping();
      await redis.quit();
      results['redis'] = { status: 'ok' };
    } catch (error) {
      results['redis'] = { status: 'error', message: (error as Error).message };
    }

    return results;
  }
}
