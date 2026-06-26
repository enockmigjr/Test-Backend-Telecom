import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ThrottlerStorage } from '@nestjs/throttler';
import { Redis } from 'ioredis';
import { redisConfig } from './redis.config';

/**
 * Stockage Redis pour le rate limiter.
 * Permet un rate limiting distribué fonctionnel avec plusieurs instances API.
 *
 * Architecture:
 * - Chaque compteur est stocké avec une clé: `throttle:{key}:{ttl_block}`
 * - Le TTL Redis correspond au ttl du throttler
 * - Atomicité via INCR + EXPIRE en pipeline
 */
@Injectable()
export class ThrottlerStorageRedisService implements ThrottlerStorage, OnModuleDestroy {
  private redis: Redis;
  private readonly prefix = 'throttle';

  constructor() {
    this.redis = new Redis({
      host: redisConfig.host,
      port: redisConfig.port,
      password: redisConfig.password || undefined,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 3) return null;
        return Math.min(times * 200, 2000);
      },
    });
  }

  /**
   * Incrémente le compteur pour une clé de rate limit.
   * Retourne le compteur actuel et le temps restant avant expiration.
   */
  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<{ totalHits: number; timeToExpire: number; isBlocked: boolean; timeToBlockExpire: number }> {
    const redisKey = this.buildKey(key, throttlerName);

    // INCR + TTL en une opération atomique via pipeline
    const pipeline = this.redis.pipeline();
    pipeline.incr(redisKey);
    pipeline.ttl(redisKey);

    const results = await pipeline.exec();
    const totalHits = (results?.[0]?.[1] as number) || 1;
    const timeToExpire = (results?.[1]?.[1] as number) || ttl;

    // Définir l'expiration si nouvelle clé
    if (totalHits === 1) {
      await this.redis.expire(redisKey, Math.ceil(ttl / 1000));
    }

    // Si blockDuration est défini et que la limite est dépassée
    const isBlocked = totalHits > limit;
    const timeToBlockExpire = isBlocked ? blockDuration : 0;

    if (isBlocked && blockDuration > 0) {
      // Définir un TTL de blocage séparé
      const blockKey = `${redisKey}:blocked`;
      await this.redis.set(blockKey, '1', 'PX', blockDuration);
    }

    return {
      totalHits,
      timeToExpire: Math.max(timeToExpire * 1000, 0), // Conversion secondes → ms
      isBlocked,
      timeToBlockExpire,
    };
  }

  private buildKey(key: string, throttlerName: string): string {
    // Nettoyer la clé pour éviter les caractères problématiques dans Redis
    const cleanKey = key.replace(/[^a-zA-Z0-9:_-]/g, '_');
    return `${this.prefix}:${throttlerName}:${cleanKey}`;
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }
}
