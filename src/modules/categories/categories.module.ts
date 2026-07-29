/**
 * ============================================================================
 * FICHIER : src/modules/categories/categories.module.ts
 * RÔLE : Module NestJS organisant le composant categories.
 * EXPLICATION :
 * Ce module regroupe et configure les contrôleurs, services, répertoires et dépendances de categories.
 * 1. Définit les éléments internes du domaine fonctionnel.
 * 2. Rend les services accessibles aux autres modules ayant importé celui-ci.
 * ============================================================================
 */

import { Module } from '@nestjs/common';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';

@Module({
  controllers: [CategoriesController],
  providers: [CategoriesService],
  exports: [CategoriesService],
})
/**
 * Module NestJS `CategoriesModule` configurant les dépendances, contrôleurs et services associés.
 */
export class CategoriesModule {}
