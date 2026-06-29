import { Global, Module, OnApplicationShutdown } from '@nestjs/common';

/**
 * Module d'observabilité NestJS.
 * Initialise le SDK OpenTelemetry au démarrage et assure le shutdown propre.
 *
 * Intégrations:
 * - HTTP (entrant/sortant)
 * - Express (middleware)
 * - NestJS (controllers, providers)
 * - PostgreSQL (requêtes SQL)
 * - Redis (commandes ioredis)
 */
@Global()
@Module({})
export class ObservabilityModule implements OnApplicationShutdown {
  onApplicationShutdown(): void {
    // OpenTelemetry SDK est arrêté via le handler SIGTERM dans otel.ts
  }
}
