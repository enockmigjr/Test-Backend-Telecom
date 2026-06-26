import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { redisConfig } from './redis.config';
import { Redis } from 'ioredis';

let redisClient: Redis | null = null;

/**
 * Fournisseur Redis partagé.
 * Initialise la connexion Redis au démarrage du module.
 */
@Injectable()
export class RedisProvider implements OnModuleInit {
  private readonly logger = new Logger(RedisProvider.name);

  async onModuleInit(): Promise<void> {
    if (!redisClient) {
      redisClient = new Redis({
        host: redisConfig.host,
        port: redisConfig.port,
        password: redisConfig.password || undefined,
        maxRetriesPerRequest: null,
        enableReadyCheck: true,
        lazyConnect: false,
      });

      redisClient.on('connect', () => {
        this.logger.log('Connecté à Redis');
      });

      redisClient.on('error', (error) => {
        this.logger.error(`Erreur Redis: ${error.message}`);
      });
    }
  }

  getClient(): Redis {
    if (!redisClient) {
      throw new Error('Redis client non initialisé');
    }
    return redisClient;
  }
}
