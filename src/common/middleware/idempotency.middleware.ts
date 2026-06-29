import { Injectable, NestMiddleware, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { Redis } from 'ioredis';
import { redisConfig } from '../providers/redis.config';

/**
 * Middleware d'idempotence.
 * Protège les routes POST/PUT/PATCH contre les requêtes en double.
 *
 * Fonctionnement:
 * 1. Le client envoie un header `Idempotency-Key` (UUID)
 * 2. Le middleware vérifie dans Redis si cette clé a déjà été utilisée
 * 3. Si oui → retourne le résultat stocké (200 ou le statut original)
 * 4. Si non → stocke la clé avec TTL 24h et laisse passer la requête
 *
 * Appliquer sur les routes critiques: POST /tickets, POST /tickets/:id/assign, etc.
 */
@Injectable()
export class IdempotencyMiddleware implements NestMiddleware {
  private redis: Redis;
  private readonly TTL_SECONDS = 86400; // 24 heures
  private readonly PREFIX = 'idempotency';

  constructor() {
    this.redis = new Redis({
      host: redisConfig.host,
      port: redisConfig.port,
      password: redisConfig.password || undefined,
      maxRetriesPerRequest: 2,
    });
  }

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    const idempotencyKey = req.headers['idempotency-key'] as string;

    // Si pas de clé, on laisse passer sans idempotence
    if (!idempotencyKey) {
      return next();
    }

    const redisKey = `${this.PREFIX}:${idempotencyKey}`;

    try {
      // Vérifier si la clé existe déjà (requête en double)
      const existing = await this.redis.get(redisKey);

      if (existing) {
        // Requête déjà traitée → retourner le résultat stocké
        const cached = JSON.parse(existing);
        res.status(cached.status || 200).json(cached.body);
        return;
      }

      // Intercepter la réponse pour la stocker
      const originalJson = res.json.bind(res);
      res.json = ((body: unknown) => {
        // Stocker le résultat dans Redis
        const cacheData = JSON.stringify({
          status: res.statusCode,
          body,
        });
        this.redis.setex(redisKey, this.TTL_SECONDS, cacheData).catch(() => {});

        return originalJson(body);
      }) as typeof res.json;

      // Marquer que la clé est en cours de traitement
      await this.redis.setex(redisKey, this.TTL_SECONDS, JSON.stringify({ status: 202, body: { processing: true } }));

      next();
    } catch (error) {
      // En cas d'erreur Redis, on laisse passer la requête
      next();
    }
  }
}
