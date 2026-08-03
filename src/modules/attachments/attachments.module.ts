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

import { forwardRef, Module } from '@nestjs/common';
import { AttachmentsController } from './attachments.controller';
import { AttachmentsService } from './attachments.service';
import { LocalStorageService } from './storage/local-storage.service';
import { TicketAccessService } from '../../common/services/ticket-access.service';
import { PublicSupportModule } from '../public-support/public-support.module';
import { PublicAttachmentsController } from './public-attachments.controller';
import { PublicAttachmentsService } from './public-attachments.service';
import { AttachmentContentInspectorService } from './security/attachment-content-inspector.service';
import { AttachmentScanService } from './security/attachment-scan.service';
import { ANTIVIRUS_SCANNER } from './security/antivirus-scanner.interface';
import { ClamavScannerService } from './security/clamav-scanner.service';
import { AttachmentQuarantineCleanupService } from './security/attachment-quarantine-cleanup.service';
import { PublicConversationAttachmentsController } from './public-conversation-attachments.controller';
import { PublicConversationAttachmentsService } from './public-conversation-attachments.service';
import { PublicAttachmentUploadGuard } from './public-attachment-upload.guard';
import { ExternalIdentityModule } from '../external-identity/external-identity.module';

/**
 * Module responsable de l'upload, du téléchargement et de la suppression des pièces jointes associées aux tickets.
 */
@Module({
  imports: [forwardRef(() => PublicSupportModule), ExternalIdentityModule],
  controllers: [AttachmentsController, PublicAttachmentsController, PublicConversationAttachmentsController],
  providers: [
    AttachmentsService,
    PublicAttachmentsService,
    LocalStorageService,
    TicketAccessService,
    AttachmentContentInspectorService,
    AttachmentScanService,
    ClamavScannerService,
    AttachmentQuarantineCleanupService,
    PublicConversationAttachmentsService,
    PublicAttachmentUploadGuard,
    { provide: ANTIVIRUS_SCANNER, useExisting: ClamavScannerService },
  ],
  exports: [AttachmentsService, LocalStorageService, AttachmentScanService, ANTIVIRUS_SCANNER],
})
/**
 * Module NestJS `AttachmentsModule` configurant les dépendances, contrôleurs et services associés.
 */
export class AttachmentsModule {}
