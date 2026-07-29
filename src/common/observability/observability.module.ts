/**
 * ============================================================================
 * FICHIER : src/common/observability/observability.module.ts
 * RÔLE : Module NestJS organisant le composant observability.
 * EXPLICATION :
 * Ce module regroupe et configure les contrôleurs, services, répertoires et dépendances de observability.
 * 1. Définit les éléments internes du domaine fonctionnel.
 * 2. Rend les services accessibles aux autres modules ayant importé celui-ci.
 * ============================================================================
 */

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
/**
 * Module NestJS `ObservabilityModule` configurant les dépendances, contrôleurs et services associés.
 */
export class ObservabilityModule implements OnApplicationShutdown {
  onApplicationShutdown(): void {
    // OpenTelemetry SDK est arrêté via le handler SIGTERM dans otel.ts
  }
}
