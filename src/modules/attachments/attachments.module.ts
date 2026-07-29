/**
 * ============================================================================
 * FICHIER : src/modules/attachments/attachments.module.ts
 * RÔLE : Module NestJS de gestion des pièces jointes et des fichiers d'incidents.
 * EXPLICATION :
 * Ce module regroupe l'ensemble des composants nécessaires au stockage et à la consultation des fichiers :
 * 1. Déclare le contrôleur REST et les services de stockage (ex: stockage disque local LocalStorageService).
 * 2. Fournit le service d'accès aux tickets TicketAccessService pour vérifier les autorisations de téléchargement.
 * 3. Exporte AttachmentsService et LocalStorageService pour réutilisation dans d'autres modules.
 * ============================================================================
 */

import { Module } from '@nestjs/common';
import { AttachmentsController } from './attachments.controller';
import { AttachmentsService } from './attachments.service';
import { LocalStorageService } from './storage/local-storage.service';
import { TicketAccessService } from '../../common/services/ticket-access.service';

/**
 * Module responsable de l'upload, du téléchargement et de la suppression des pièces jointes associées aux tickets.
 */
@Module({
  controllers: [AttachmentsController],
  providers: [AttachmentsService, LocalStorageService, TicketAccessService],
  exports: [AttachmentsService, LocalStorageService],
})
/**
 * Module NestJS `AttachmentsModule` configurant les dépendances, contrôleurs et services associés.
 */
export class AttachmentsModule {}
