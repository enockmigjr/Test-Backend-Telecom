/**
 * ============================================================================
 * FICHIER : src/modules/comments/dto/create-comment.dto.ts
 * RÔLE : DTO de validation pour la création d'un commentaire public sur un ticket.
 * EXPLICATION :
 * Ce DTO valide le texte d'un commentaire public rédigé par un agent ou un client (POST /tickets/:ticketId/comments) :
 * 1. `content` : Texte du message (de 1 à 5 000 caractères max).
 * 2. Les commentaires publics sont visibles par l'ensemble des rôles ayant accès au ticket.
 * ============================================================================
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MinLength, MaxLength } from 'class-validator';

/**
 * Objet DTO de création d'un commentaire public.
 */
export class CreateCommentDto {
  /** Contenu textuel du commentaire public (1 à 5000 caractères). */
  @ApiProperty({
    description: 'Contenu du commentaire public',
    example: 'Information complémentaire sur la panne en cours — le technicien est sur place.',
    minLength: 1,
    maxLength: 5000,
  })
  @IsString({ message: 'Le contenu est requis.' })
  @MinLength(1, { message: 'Le contenu ne peut pas être vide.' })
  @MaxLength(5000, { message: 'Le contenu ne peut pas dépasser 5000 caractères.' })
  content: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Réponse précédente corrigée; la réponse originale reste immuable.',
  })
  @IsOptional()
  @IsUUID()
  correctsCommentId?: string;
}
