/**
 * ============================================================================
 * FICHIER : src/modules/comments/dto/update-comment.dto.ts
 * RÔLE : DTO de validation pour la modification d'un commentaire public.
 * EXPLICATION :
 * Ce DTO valide la mise à jour du texte d'un commentaire public existant (PATCH /tickets/:ticketId/comments/:commentId) :
 * 1. `content` : Nouveau texte du commentaire (de 1 à 5 000 caractères max).
 * 2. Seul l'auteur initial du commentaire ou un administrateur peut le modifier.
 * ============================================================================
 */

import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength, MaxLength } from 'class-validator';

/**
 * Objet DTO de mise à jour d'un commentaire public.
 */
export class UpdateCommentDto {
  /** Nouveau contenu textuel du commentaire (1 à 5000 caractères). */
  @ApiProperty({
    description: 'Contenu mis à jour du commentaire',
    example: 'Mise à jour : le technicien a identifié la panne, intervention en cours.',
    minLength: 1,
    maxLength: 5000,
  })
  @IsString({ message: 'Le contenu est requis.' })
  @MinLength(1, { message: 'Le contenu ne peut pas être vide.' })
  @MaxLength(5000, { message: 'Le contenu ne peut pas dépasser 5000 caractères.' })
  content: string;
}
