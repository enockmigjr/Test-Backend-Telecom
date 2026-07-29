/**
 * ============================================================================
 * FICHIER : src/common/metrics/metrics.module.ts
 * RÔLE : Module NestJS organisant le composant metrics.
 * EXPLICATION :
 * Ce module regroupe et configure les contrôleurs, services, répertoires et dépendances de metrics.
 * 1. Définit les éléments internes du domaine fonctionnel.
 * 2. Rend les services accessibles aux autres modules ayant importé celui-ci.
 * ============================================================================
 */

import { Global, Module } from '@nestjs/common';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';

@Global()
@Module({
  controllers: [MetricsController],
  providers: [MetricsService],
  exports: [MetricsService],
})
/**
 * Module NestJS `MetricsModule` configurant les dépendances, contrôleurs et services associés.
 */
export class MetricsModule {}
