/**
 * ============================================================================
 * FICHIER : src/modules/internal-notes/internal-notes.module.ts
 * RÔLE : Module NestJS organisant le composant internal-notes.
 * EXPLICATION :
 * Ce module regroupe et configure les contrôleurs, services, répertoires et dépendances de internal-notes.
 * 1. Définit les éléments internes du domaine fonctionnel.
 * 2. Rend les services accessibles aux autres modules ayant importé celui-ci.
 * ============================================================================
 */

import { Module } from '@nestjs/common';
import { InternalNotesController } from './internal-notes.controller';
import { InternalNotesService } from './internal-notes.service';
import { TicketAccessService } from '../../common/services/ticket-access.service';

@Module({
  controllers: [InternalNotesController],
  providers: [InternalNotesService, TicketAccessService],
  exports: [InternalNotesService],
})
/**
 * Module NestJS `InternalNotesModule` configurant les dépendances, contrôleurs et services associés.
 */
export class InternalNotesModule {}
