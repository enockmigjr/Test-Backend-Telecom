/**
 * ============================================================================
 * FICHIER : src/common/providers/redis.provider.ts
 * RÔLE : Fournisseur singleton NestJS de la connexion ioredis à Redis.
 * EXPLICATION :
 * Ce service gère le cycle de vie de la connexion à l'instance Redis :
 * 1. Maintient un singleton `redisClient` partagé entre la mise en cache (Dashboard),
 *    la révocation de jetons JWT (Blacklist) et la limitation de débit (Throttler).
 * 2. Configure `maxRetriesPerRequest: null` indispensable pour la compatibilité avec BullMQ.
 * 3. Journalise les événements de connexion et de rupture d'accès via Pino/Nest Logger.
 * ============================================================================
 */

import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { redisConfig } from './redis.config';
import { Redis } from 'ioredis';

/** Instance unique (singleton) du client ioredis au niveau du module. */
let redisClient: Redis | null = null;

/**
 * Service NestJS initialisant et exposant l'instance ioredis. * Fournisseur Redis partagé.
 * Initialise la connexion Redis au démarrage du module.
 * Fournisseur Redis partagé.
 */
@Injectable()
export class RedisProvider implements OnModuleInit {
  private readonly logger = new Logger(RedisProvider.name);

  /**
   * Initialise le client ioredis lors de la phase d'initialisation du module NestJS.
   */
  async onModuleInit(): Promise<void> {
    if (!redisClient) {
      redisClient = new Redis({
        host: redisConfig.host,
        port: redisConfig.port,
        password: redisConfig.password || undefined,
        maxRetriesPerRequest: null, // Exigence essentielle de BullMQ pour le blocage des queues
        enableReadyCheck: true,
        lazyConnect: false,
      });

      // Écouteurs d'événements de connexion et d'erreur ioredis
      redisClient.on('connect', () => {
        this.logger.log('Connecté à Redis avec succès');
      });

      redisClient.on('error', (error) => {
        this.logger.error(`Erreur de connexion Redis: ${error.message}`);
      });
    }
  }

  /**
   * Récupère l'instance active du client ioredis.
   *
   * @returns L'instance ioredis configurée.
   * @throws Error si appelée avant l'initialisation du module.
   */
  getClient(): Redis {
    if (!redisClient) {
      throw new Error('Client Redis non initialisé.');
    }
    return redisClient;
  }
}
