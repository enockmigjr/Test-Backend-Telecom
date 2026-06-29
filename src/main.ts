// OpenTelemetry — doit être initialisé AVANT tout import NestJS
import { initOpenTelemetry } from './common/observability/otel';
if (process.env['OTEL_ENABLED'] !== 'false') {
  initOpenTelemetry();
}

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import helmet from 'helmet';
import compression from 'compression';

import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { CorrelationIdMiddleware } from './common/middleware/correlation-id.middleware';
import { RequestLoggerMiddleware } from './common/middleware/request-logger.middleware';
import { AppConfigService } from './config/app.config';
import { RedisIoAdapter } from './websocket/redis-io.adapter';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

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

  // Swagger / OpenAPI
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Telecom Ticket Management API')
    .setDescription("Système de Gestion des Tickets d\'Incidents Télécom")
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('auth', 'Authentification')
    .addTag('users', 'Utilisateurs')
    .addTag('departments', 'Départements')
    .addTag('tickets', "Tickets d\'incidents")
    .addTag('comments', 'Commentaires publics')
    .addTag('internal-notes', 'Notes internes')
    .addTag('attachments', 'Pièces jointes')
    .addTag('notifications', 'Notifications')
    .addTag('sla', 'Politiques SLA')
    .addTag('dashboard', 'Tableaux de bord')
    .addTag('audit-logs', "Journaux d'audit")
    .addTag('reports', 'Rapports (PDF, SLA)')
    .addTag('health', 'Health checks')
    .addTag('root', 'API Info')
    .addTag('metrics', 'Prometheus Metrics')
    .addTag('email', 'Notifications email')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(config.port);

  const logger = app.get(Logger);
  logger.log(`🚀 API démarrée sur http://localhost:${config.port}/${config.apiPrefix}`);
  logger.log(`📚 Swagger disponible sur http://localhost:${config.port}/api/docs`);
}

bootstrap();
