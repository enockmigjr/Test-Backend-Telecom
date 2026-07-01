import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { Redis } from 'ioredis';
import { redisConfig } from '../src/common/providers/redis.config';

/**
 * Setup helper pour les tests E2E.
 * Crée une instance d'application NestJS configurée comme en production.
 *
 * Usage:
 *   const { app, flushRedis } = await createTestApp();
 *   await flushRedis(); // Nettoyer les compteurs de rate-limit
 *   // ... tests ...
 *   await app.close();
 *
 * Note: La journalisation Pino est réduite au niveau 'error' pour éviter
 * le bruit dans les rapports de test.
 */
export async function createTestApp(): Promise<{ app: INestApplication; flushRedis: () => Promise<void> }> {
  // Réduire le niveau de log pour les tests
  process.env.LOG_LEVEL = 'error';
  // Augmenter les limites du throttler pour éviter les erreurs 429 en E2E
  process.env.THROTTLE_LIMIT = '10000';
  process.env.THROTTLE_AUTH_LIMIT = '10000';
  // Réduire le TTL du throttler pour éviter la persistance entre les tests
  process.env.THROTTLE_TTL = '1000';
  process.env.THROTTLE_AUTH_TTL = '1000';

  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication();

  app.useLogger(new Logger('E2E', { timestamp: false }));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.setGlobalPrefix('api/v1');
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(new TransformInterceptor());

  await app.init();

  // Créer une fonction pour flusher les clés throttle dans Redis
  const flushRedis = async () => {
    try {
      const redis = new Redis({
        host: redisConfig.host,
        port: redisConfig.port,
        password: redisConfig.password || undefined,
        connectTimeout: 3000,
        maxRetriesPerRequest: 1,
      });
      // Supprimer uniquement les clés de throttle
      const keys = await redis.keys('throttle:*');
      if (keys.length > 0) {
        await redis.del(...keys);
      }
      await redis.quit();
    } catch {
      // Redis non disponible — OK pour les tests unitaires
    }
  };

  return { app, flushRedis };
}
