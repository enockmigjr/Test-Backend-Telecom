import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';

/**
 * Setup helper pour les tests E2E.
 * Cree une instance d'application NestJS configuree comme en production.
 *
 * Usage:
 *   const app = await createTestApp();
 *   // ... tests ...
 *   await app.close();
 *
 * Note: La journalisation Pino est reduite au niveau 'error' pour eviter
 * le bruit dans les rapports de test.
 */
export async function createTestApp(): Promise<INestApplication> {
  // Reduire le niveau de log pour les tests
  process.env.LOG_LEVEL = 'error';
  // Augmenter les limites du throttler pour éviter les erreurs 429 en E2E
  process.env.THROTTLE_LIMIT = '10000';
  process.env.THROTTLE_AUTH_LIMIT = '10000';

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

  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(new TransformInterceptor());

  await app.init();

  return app;
}
