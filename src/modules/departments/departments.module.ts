/**
 * ============================================================================
 * FICHIER : src/modules/departments/departments.module.ts
 * RÔLE : Module NestJS organisant le composant departments.
 * EXPLICATION :
 * Ce module regroupe et configure les contrôleurs, services, répertoires et dépendances de departments.
 * 1. Définit les éléments internes du domaine fonctionnel.
 * 2. Rend les services accessibles aux autres modules ayant importé celui-ci.
 * ============================================================================
 */

import { Module } from '@nestjs/common';
import { DepartmentsController } from './departments.controller';
import { DepartmentsService } from './departments.service';

@Module({
  controllers: [DepartmentsController],
  providers: [DepartmentsService],
  exports: [DepartmentsService],
})
/**
 * Module NestJS `DepartmentsModule` configurant les dépendances, contrôleurs et services associés.
 */
export class DepartmentsModule {}
