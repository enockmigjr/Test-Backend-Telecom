/**
 * ============================================================================
 * FICHIER : src/config/app-config.module.ts
 * RÔLE : Module NestJS distribuant les services de configuration à toute l'application.
 * EXPLICATION :
 * Ce module est déclaré comme "Global" (`@Global()`). Cela signifie qu'une fois
 * chargé au démarrage, tous les autres modules du projet peuvent accéder directement
 * aux configurations système, base de données et sécurité (JWT) sans avoir à réimporter ce module.
 * ============================================================================
 */

import { Global, Module } from '@nestjs/common';
import { AppConfigService } from './app.config';
import { DatabaseConfigService } from './database.config';
import { JwtConfigService } from './jwt.config';
import { PublicSupportConfigService } from './public-support.config';

/**
 * Liste des services de configuration regroupés dans ce module.
 */
const configServices = [AppConfigService, DatabaseConfigService, JwtConfigService, PublicSupportConfigService];

/**
 * Déclaration du module global NestJS de configuration.
 */
@Global()
@Module({
  providers: configServices,
  exports: configServices,
})
/**
 * Module NestJS `AppConfigModule` configurant les dépendances, contrôleurs et services associés.
 */
export class AppConfigModule {}
