/**
 * ============================================================================
 * FICHIER : src/modules/app/app.module.ts
 * RÔLE : Module NestJS organisant le composant app.
 * EXPLICATION :
 * Ce module regroupe et configure les contrôleurs, services, répertoires et dépendances de app.
 * 1. Définit les éléments internes du domaine fonctionnel.
 * 2. Rend les services accessibles aux autres modules ayant importé celui-ci.
 * ============================================================================
 */

import { Module } from '@nestjs/common';
import { AppController } from './app.controller';

@Module({
  controllers: [AppController],
})
/**
 * Module NestJS `AppInfoModule` configurant les dépendances, contrôleurs et services associés.
 */
export class AppInfoModule {}
