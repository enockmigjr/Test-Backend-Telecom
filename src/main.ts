// OpenTelemetry — doit être initialisé AVANT tout import NestJS
import { initOpenTelemetry } from './common/observability/otel';
if (process.env['OTEL_ENABLED'] !== 'false') {
  initOpenTelemetry();
}

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import helmet from 'helmet';
import compression from 'compression';

import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { MetricsInterceptor } from './common/interceptors/metrics.interceptor';
import { MetricsService } from './common/metrics/metrics.service';
import { CorrelationIdMiddleware } from './common/middleware/correlation-id.middleware';
import { RequestLoggerMiddleware } from './common/middleware/request-logger.middleware';
import { AppConfigService } from './config/app.config';
import { RedisIoAdapter } from './websocket/redis-io.adapter';
import { createOpenApiDocument } from './common/openapi/openapi.config';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  // Activer le trust proxy pour lire correctement l'IP derrière Nginx (rate limiting)
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.set('trust proxy', 1);

  const config = app.get(AppConfigService);

  // Adapter Redis pour WebSocket (scaling horizontal)
  const redisAdapter = new RedisIoAdapter(app);
  await redisAdapter.connectToRedis();
  app.useWebSocketAdapter(redisAdapter);

  // Logger Pino
  app.useLogger(app.get(Logger));

  // Préfixe global API
  app.setGlobalPrefix(config.apiPrefix);

  // Sécurité
  app.use(helmet());
  app.enableCors({
    origin: config.corsOrigin.split(',').map((o) => o.trim()),
    credentials: true,
  });

  // Compression
  app.use(compression());

  // Middlewares globaux (bind this pour éviter la perte de contexte)
  const correlationId = new CorrelationIdMiddleware();
  const requestLogger = new RequestLoggerMiddleware();
  app.use(correlationId.use.bind(correlationId));
  app.use(requestLogger.use.bind(requestLogger));

  // Validation globale
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Filtre d'exception global
  app.useGlobalFilters(new GlobalExceptionFilter());

  // Intercepteur de transformation
  app.useGlobalInterceptors(new TransformInterceptor());

  // Intercepteur de métriques HTTP (après transformation pour obtenir le bon statusCode)
  const metricsService = app.get(MetricsService);
  app.useGlobalInterceptors(new MetricsInterceptor(metricsService));

  // Swagger / OpenAPI
  const document = createOpenApiDocument(app);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(config.port);

  const logger = app.get(Logger);
  const apiHost = process.env['API_PUBLIC_HOST'] || `localhost:${config.port}`;
  logger.log(`🚀 API démarrée sur http://${apiHost}/${config.apiPrefix}`);
  logger.log(`📚 Swagger disponible sur http://${apiHost}/api/docs`);
}

bootstrap();
