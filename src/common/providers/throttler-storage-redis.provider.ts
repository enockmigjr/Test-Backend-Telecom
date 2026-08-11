/**
 * ============================================================================
 * FICHIER : src/common/providers/throttler-storage-redis.provider.ts
 * RÔLE : Adaptateur de stockage Redis distribué pour le rate limiter `@nestjs/throttler`.
 * EXPLICATION :
 * Ce service permet de distribuer la limitation de débit HTTP sur plusieurs instances de serveurs (scaling horizontal) :
 * 1. Utilise un pipeline Redis atomique (`INCR` + `TTL`) pour incrémenter le compteur de requêtes par IP sans race condition.
 * 2. Positionne la durée de vie (TTL) en millisecondes sur la clé Redis `throttle:{throttlerName}:{key}`.
 * 3. Gère le blocage temporaire automatique des IP malveillantes en enregistrant la clé `:blocked` lors d'un dépassement de quota.
 * ============================================================================
 */

import { Injectable, Logger, OnModuleDestroy, Optional } from '@nestjs/common';
import { ThrottlerStorage } from '@nestjs/throttler';
import { Redis } from 'ioredis';
import { redisConfig } from './redis.config';

/**
 * Stockage Redis pour le rate limiter.
 * Supporte le scaling horizontal avec Redis partagé.
 *
 * Si un client Redis est fourni via le constructeur, il est réutilisé
 * (connexion mutualisée). Sinon, une connexion dédiée est créée.
 * Service de stockage Redis pour le rate-limiter Throttler.
 */
@Injectable()
export class ThrottlerStorageRedisService implements ThrottlerStorage, OnModuleDestroy {
  private readonly logger = new Logger(ThrottlerStorageRedisService.name);
  private redis: Redis;
  private readonly prefix = 'throttle';
  private ownsConnection = false;
  private readonly memoryFallback = new Map<string, { hits: number; expiresAt: number }>();

  /**
   * Initialise le stockage Throttler en réutilisant une connexion ioredis existante ou en créant un client dédié.
   *
   * @param existingRedis Client ioredis partagé facultatif.
   */
  constructor(@Optional() existingRedis?: Redis) {
    if (existingRedis) {
      this.redis = existingRedis;
    } else {
      this.redis = new Redis({
        host: redisConfig.host,
        port: redisConfig.port,
        password: redisConfig.password || undefined,
        // Échec rapide hors ligne : le repli mémoire doit répondre immédiatement pendant une panne.
        enableOfflineQueue: false,
        maxRetriesPerRequest: 1,
        retryStrategy(times) {
          // Retry permanent plafonné : le client reconnate quand Redis revient.
          return Math.min(times * 200, 5000);
        },
      });
      this.redis.on('error', (error: Error) => {
        // Empêche un 'error' non géré de faire tomber le process pendant une panne Redis.
        this.logger.warn(`Redis (throttler) indisponible : ${error.message}`);
      });
      this.ownsConnection = true;
    }
  }

  /**
   * Incrémente de manière atomique le compteur d'accès pour une clé et un throttler donnés.
   *
   * @param key Identifiant du client (IP ou identifiant utilisateur).
   * @param ttl Fenêtre de temps de validité en millisecondes.
   * @param limit Nombre maximal de requêtes autorisées.
   * @param blockDuration Durée de blocage en millisecondes si le quota est dépassé.
   * @param throttlerName Nom de la règle d'interception (ex: 'default' ou 'auth').
   * @returns État du quota (hits actuels, expiration, statut de blocage).
   */
  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<{ totalHits: number; timeToExpire: number; isBlocked: boolean; timeToBlockExpire: number }> {
    const redisKey = this.buildKey(key, throttlerName);

    try {
      // Exécution atomique INCR + TTL via pipeline Redis
      const pipeline = this.redis.pipeline();
      pipeline.incr(redisKey);
      pipeline.ttl(redisKey);

      const results = await pipeline.exec();
      const totalHits = (results?.[0]?.[1] as number) || 1;
      const timeToExpire = (results?.[1]?.[1] as number) || ttl;

      // Définir la durée de vie TTL lors de la création de la clé (1er appel)
      if (totalHits === 1) {
        await this.redis.expire(redisKey, Math.ceil(ttl / 1000));
      }

      // Évaluation du dépassement de quota
      const isBlocked = totalHits > limit;
      const timeToBlockExpire = isBlocked ? blockDuration : 0;

      if (isBlocked && blockDuration > 0) {
        // Enregistrement de la clé de blocage avec durée de punition
        const blockKey = `${redisKey}:blocked`;
        await this.redis.set(blockKey, '1', 'PX', blockDuration);
      }

      return {
        totalHits,
        timeToExpire: Math.max(timeToExpire * 1000, 0), // Conversion secondes → millisecondes
        isBlocked,
        timeToBlockExpire,
      };
    } catch {
      // Repli mémoire : le rate-limit se dégrade (compteur par processus) sans faire tomber l'API.
      return this.incrementInMemory(redisKey, ttl, limit, blockDuration);
    }
  }

  private incrementInMemory(
    redisKey: string,
    ttl: number,
    limit: number,
    blockDuration: number,
  ): { totalHits: number; timeToExpire: number; isBlocked: boolean; timeToBlockExpire: number } {
    const now = Date.now();
    if (this.memoryFallback.size > 5000) {
      for (const [key, candidate] of this.memoryFallback) {
        if (candidate.expiresAt <= now) this.memoryFallback.delete(key);
      }
    }
    const entry = this.memoryFallback.get(redisKey);
    if (!entry || entry.expiresAt <= now) {
      this.memoryFallback.set(redisKey, { hits: 1, expiresAt: now + ttl });
      return { totalHits: 1, timeToExpire: ttl, isBlocked: false, timeToBlockExpire: 0 };
    }
    entry.hits += 1;
    const isBlocked = entry.hits > limit;
    return {
      totalHits: entry.hits,
      timeToExpire: Math.max(entry.expiresAt - now, 0),
      isBlocked,
      timeToBlockExpire: isBlocked && blockDuration > 0 ? blockDuration : 0,
    };
  }

  /**
   * Assainit la clé de requêtage en remplaçant les caractères spéciaux par des tirets bas.
   */
  private buildKey(key: string, throttlerName: string): string {
    // Nettoyer la clé pour éviter les caractères problématiques dans Redis
    const cleanKey = key.replace(/[^a-zA-Z0-9:_-]/g, '_');
    return `${this.prefix}:${throttlerName}:${cleanKey}`;
  }

  /**
   * Ferme proprement la connexion ioredis si ce service en possède la propriété.
   */
  async onModuleDestroy(): Promise<void> {
    if (this.ownsConnection) await this.redis.quit();
  }
}
