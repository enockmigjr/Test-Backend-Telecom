/**
 * ============================================================================
 * FICHIER : src/modules/internal-notes/dto/update-internal-note.dto.ts
 * RÔLE : DTO de validation pour la modification d'une note interne.
 * EXPLICATION :
 * Ce DTO valide le nouveau texte d'une note interne confidentielle existante (PATCH /tickets/:ticketId/internal-notes/:noteId) :
 * 1. `content` : Nouveau texte de la note interne.
 * 2. Seul l'auteur de la note ou un administrateur système peut procéder à cette modification.
 * ============================================================================
 */

import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

/**
 * Objet DTO de mise à jour d'une note interne confidentielle.
 */
export class UpdateInternalNoteDto {
  /** Nouveau contenu textuel de la note interne (1 caractère minimum). */
  @ApiProperty({
    description: 'Contenu mis à jour de la note interne',
    example: 'Diagnostic confirmé : remplacement du routeur R7 programmé pour ce soir 22h.',
    minLength: 1,
  })
  @IsString({ message: 'Le contenu est requis.' })
  @MinLength(1, { message: 'Le contenu ne peut pas être vide.' })
  content: string;
}
