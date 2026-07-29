/**
 * ============================================================================
 * FICHIER : src/modules/notifications/notifications.module.ts
 * RÔLE : Module NestJS organisant le composant notifications.
 * EXPLICATION :
 * Ce module regroupe et configure les contrôleurs, services, répertoires et dépendances de notifications.
 * 1. Définit les éléments internes du domaine fonctionnel.
 * 2. Rend les services accessibles aux autres modules ayant importé celui-ci.
 * ============================================================================
 */

import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
/**
 * Module NestJS `NotificationsModule` configurant les dépendances, contrôleurs et services associés.
 */
export class NotificationsModule {}
