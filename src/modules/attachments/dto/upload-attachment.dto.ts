/**
 * ============================================================================
 * FICHIER : src/modules/attachments/dto/upload-attachment.dto.ts
 * RÔLE : DTO de validation pour le téléversement de pièces jointes.
 * EXPLICATION :
 * Ce DTO associe un fichier téléversé (`multipart/form-form-data`) à son entité hôte dans le système (POST /attachments/upload) :
 * 1. `ticketId` : Identifiant UUIDv7 du ticket auquel est rattaché le fichier.
 * 2. `commentId` : Identifiant UUIDv7 facultatif du commentaire public hôte.
 * 3. `internalNoteId` : Identifiant UUIDv7 facultatif de la note interne confidentielle hôte.
 * ============================================================================
 */

import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

/**
 * DTO d'association d'une pièce jointe téléversée à un ticket, un commentaire ou une note interne.
 */
export class UploadAttachmentDto {
  /** Identifiant UUIDv7 du ticket d'incident cible (facultatif si lié à un commentaire/note). */
  @ApiPropertyOptional({ description: 'UUID du ticket', example: '018b3d6f-7e8c-7123-89ab-cdef01234567' })
  @IsOptional()
  @IsUUID('all', { message: "L'identifiant du ticket doit être un UUID valide." })
  ticketId?: string;

  /** Identifiant UUIDv7 du commentaire public hôte (facultatif). */
  @ApiPropertyOptional({ description: 'UUID du commentaire', example: '018b3d6f-7e8c-7123-89ab-cdef01234568' })
  @IsOptional()
  @IsUUID('all', { message: "L'identifiant du commentaire doit être un UUID valide." })
  commentId?: string;

  /** Identifiant UUIDv7 de la note interne confidentielle hôte (facultatif). */
  @ApiPropertyOptional({ description: 'UUID de la note interne', example: '018b3d6f-7e8c-7123-89ab-cdef01234569' })
  @IsOptional()
  @IsUUID('all', { message: "L'identifiant de la note interne doit être un UUID valide." })
  internalNoteId?: string;
}
