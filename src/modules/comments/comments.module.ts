/**
 * ============================================================================
 * FICHIER : src/modules/comments/comments.module.ts
 * RÔLE : Module NestJS organisant le composant comments.
 * EXPLICATION :
 * Ce module regroupe et configure les contrôleurs, services, répertoires et dépendances de comments.
 * 1. Définit les éléments internes du domaine fonctionnel.
 * 2. Rend les services accessibles aux autres modules ayant importé celui-ci.
 * ============================================================================
 */

import { Module } from '@nestjs/common';
import { CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';
import { TicketAccessService } from '../../common/services/ticket-access.service';

@Module({
  controllers: [CommentsController],
  providers: [CommentsService, TicketAccessService],
  exports: [CommentsService],
})
/**
 * Module NestJS `CommentsModule` configurant les dépendances, contrôleurs et services associés.
 */
export class CommentsModule {}
