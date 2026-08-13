/**
 * ============================================================================
 * FICHIER : src/modules/users/users.module.ts
 * RÔLE : Module NestJS organisant le composant users.
 * EXPLICATION :
 * Ce module regroupe et configure les contrôleurs, services, répertoires et dépendances de users.
 * 1. Définit les éléments internes du domaine fonctionnel.
 * 2. Rend les services accessibles aux autres modules ayant importé celui-ci.
 * ============================================================================
 */

import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
/**
 * Module NestJS `UsersModule` configurant les dépendances, contrôleurs et services associés.
 */
export class UsersModule {}
