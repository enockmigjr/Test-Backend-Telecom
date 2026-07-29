/**
 * ============================================================================
 * FICHIER : src/modules/dashboard/dashboard.module.ts
 * RÔLE : Module NestJS organisant le composant dashboard.
 * EXPLICATION :
 * Ce module regroupe et configure les contrôleurs, services, répertoires et dépendances de dashboard.
 * 1. Définit les éléments internes du domaine fonctionnel.
 * 2. Rend les services accessibles aux autres modules ayant importé celui-ci.
 * ============================================================================
 */

import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { DashboardSlaService } from './dashboard-sla.service';

@Module({
  controllers: [DashboardController],
  providers: [DashboardService, DashboardSlaService],
})
/**
 * Module NestJS `DashboardModule` configurant les dépendances, contrôleurs et services associés.
 */
export class DashboardModule {}
