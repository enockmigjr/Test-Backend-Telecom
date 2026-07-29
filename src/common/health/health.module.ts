/**
 * ============================================================================
 * FICHIER : src/common/health/health.module.ts
 * RÔLE : Module NestJS regroupant le contrôleur et le service de santé (Health Check).
 * EXPLICATION :
 * Ce module associe la route d'API `/health` au service de test de santé.
 * ============================================================================
 */

import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

/**
 * Module HealthModule
 */
@Module({
  controllers: [HealthController],
  providers: [HealthService],
})
/**
 * Module NestJS `HealthModule` configurant les dépendances, contrôleurs et services associés.
 */
export class HealthModule {}
