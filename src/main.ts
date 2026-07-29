/**
 * ============================================================================
 * FICHIER : src/main.ts
 * RÔLE : Point d'entrée principal du serveur backend NestJS.
 * EXPLICATION (Pour non-développeurs) :
 * Ce fichier est le "bouton de démarrage" de toute l'application. C'est ici que :
 * 1. Le système de traçabilité et métriques (OpenTelemetry) est initialisé.
 * 2. L'application NestJS est créée et configurée.
 * 3. Les sécurités (Helmet, CORS), la compression, la validation des données et les logs sont configurés.
 * 4. La documentation interactive de l'API (Swagger) est générée.
 * 5. Le serveur commence à écouter les requêtes des utilisateurs sur le port configuré.
 * ============================================================================
 */

// OpenTelemetry — doit être initialisé AVANT tout import NestJS pour capturer les traces de performance
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

/**
 * Fonction de démarrage asynchrone (bootstrap) de l'application.
 */
async function bootstrap(): Promise<void> {
  // Création de l'application NestJS à partir du module racine AppModule
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true, // Conserve les logs en mémoire tampon jusqu'à ce que le logger soit prêt
  });

  // Activer le "trust proxy" pour lire correctement l'adresse IP réelle de l'utilisateur derrière Nginx
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.set('trust proxy', 1);

  // Récupération du service de configuration globale de l'application
  const config = app.get(AppConfigService);

  // Configuration de l'adaptateur Redis pour la gestion des WebSockets en temps réel (permet le passage à l'échelle)
  const redisAdapter = new RedisIoAdapter(app);
  await redisAdapter.connectToRedis();
  app.useWebSocketAdapter(redisAdapter);

  // Définition du logger structuré (Pino) pour afficher des journaux système propres au format JSON
  app.useLogger(app.get(Logger));

  // Définition du préfixe d'URL global pour toutes les routes API (ex: /api/v1)
  app.setGlobalPrefix(config.apiPrefix);

  // Configuration de la sécurité avec Helmet (en-têtes HTTP sécurisés) et CORS (gestion des accès depuis le frontend)
  app.use(helmet());
  app.enableCors({
    origin: config.corsOrigin.split(',').map((o) => o.trim()),
    credentials: true,
  });

  // Activation de la compression des réponses HTTP pour accélérer les échanges réseau
  app.use(compression());

  // Activation des middlewares globaux : identifiant unique de requête (CorrelationId) et journalisation (RequestLogger)
  const correlationId = new CorrelationIdMiddleware();
  const requestLogger = new RequestLoggerMiddleware();
  app.use(correlationId.use.bind(correlationId));
  app.use(requestLogger.use.bind(requestLogger));

  // Activation du tuyau de validation globale pour s'assurer que toutes les données reçues correspondent exactement à ce qui est attendu
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Supprime automatiquement les champs non autorisés dans les requêtes
      forbidNonWhitelisted: true, // Renvoie une erreur si des champs inconnus sont envoyés
      transform: true, // Convertit automatiquement les types (ex: string en number)
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Capture et gestion centralisée de toutes les erreurs de l'application
  app.useGlobalFilters(new GlobalExceptionFilter());

  // Intercepteur pour harmoniser le format des réponses HTTP retournées aux clients
  app.useGlobalInterceptors(new TransformInterceptor());

  // Intercepteur de métriques Prometheus pour suivre le temps de réponse et l'état des requêtes
  const metricsService = app.get(MetricsService);
  app.useGlobalInterceptors(new MetricsInterceptor(metricsService));

  // Génération et publication de la documentation OpenAPI / Swagger (accessible via l'URL /api/docs)
  const document = createOpenApiDocument(app);
  SwaggerModule.setup('api/docs', app, document);

  // Démarrage de l'écoute sur le port réseau configuré (ex: 3000)
  await app.listen(config.port);

  // Affichage d'un message de succès dans les logs avec l'adresse d'accès à l'API et à Swagger
  const logger = app.get(Logger);
  const apiHost = process.env['API_PUBLIC_HOST'] || `localhost:${config.port}`;
  logger.log(`🚀 API démarrée sur http://${apiHost}/${config.apiPrefix}`);
  logger.log(`📚 Swagger disponible sur http://${apiHost}/api/docs`);
}

// Lancement effectif du démarrage
bootstrap();
