/**
 * ============================================================================
 * FICHIER : src/modules/settings/settings.module.ts
 * RÔLE : Module NestJS organisant le composant settings.
 * EXPLICATION :
 * Ce module regroupe et configure les contrôleurs, services, répertoires et dépendances de settings.
 * 1. Définit les éléments internes du domaine fonctionnel.
 * 2. Rend les services accessibles aux autres modules ayant importé celui-ci.
 * ============================================================================
 */

import { Global, Module } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { SettingsController } from './settings.controller';
import { DrizzleProvider } from '../../database/drizzle.provider';

@Global()
@Module({
  providers: [SettingsService, DrizzleProvider],
  controllers: [SettingsController],
  exports: [SettingsService],
})
/**
 * Module NestJS `SettingsModule` configurant les dépendances, contrôleurs et services associés.
 */
export class SettingsModule {}
