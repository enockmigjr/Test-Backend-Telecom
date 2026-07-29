/**
 * ============================================================================
 * FICHIER : src/modules/internal-notes/dto/create-internal-note.dto.ts
 * RÔLE : DTO de validation pour la création d'une note interne confidentielle.
 * EXPLICATION :
 * Ce DTO valide la saisie d'une note interne réservée à la collaboration inter-équipes (POST /tickets/:ticketId/internal-notes) :
 * 1. `content` : Texte de la note confidentielle.
 * 2. Les notes internes sont strictement masquées aux techniciens de terrain (`FIELD_TECHNICIAN`) et aux clients.
 * ============================================================================
 */

import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

/**
 * Objet DTO de création d'une note interne confidentielle.
 */
export class CreateInternalNoteDto {
  /** Contenu textuel de la note interne (1 caractère minimum). */
  @ApiProperty({
    description: 'Contenu de la note interne (visible uniquement par les équipes autorisées)',
    example: 'Vérification du diagnostic NOC — le problème semble venir du routeur R7.',
    minLength: 1,
  })
  @IsString({ message: 'Le contenu est requis.' })
  @MinLength(1, { message: 'Le contenu ne peut pas être vide.' })
  content: string;
}
