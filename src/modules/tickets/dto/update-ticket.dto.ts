/**
 * ============================================================================
 * FICHIER : src/modules/tickets/dto/update-ticket.dto.ts
 * RÔLE : DTO de validation pour la mise à jour partielle des champs d'un ticket.
 * EXPLICATION :
 * Ce DTO valide la modification facultative des métadonnées d'un ticket (PATCH /tickets/:id) :
 * 1. `title` & `description` : Modification de l'intitulé ou des détails explicatifs.
 * 2. `priority` & `severity` : Réajustement de la priorité (LOW à CRITICAL) et de la sévérité (S1 à S4).
 * 3. `categoryId` : Recatégorisation de l'incident.
 * 4. `tags` : Étiquettes de classement sous forme de texte libre ou séparées par des virgules.
 * ============================================================================
 */

import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

/**
 * Objet DTO de mise à jour d'un ticket.
 */
export class UpdateTicketDto {
  /** Nouveau titre du ticket (facultatif, max 255 caractères). */
  @ApiPropertyOptional({ description: 'Nouveau titre', example: 'Panne Fibre - Zone Industrielle Nord' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  /** Nouvelle description explicative du problème (facultative). */
  @ApiPropertyOptional({ description: 'Nouvelle description' })
  @IsOptional()
  @IsString()
  description?: string;

  /** Niveau de priorité du ticket (LOW, MEDIUM, HIGH, CRITICAL). */
  @ApiPropertyOptional({ enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] })
  @IsOptional()
  @IsIn(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], { message: 'Priorité invalide.' })
  priority?: string;

  /** Niveau de sévérité télécom (S1, S2, S3, S4). */
  @ApiPropertyOptional({ enum: ['S1', 'S2', 'S3', 'S4'] })
  @IsOptional()
  @IsIn(['S1', 'S2', 'S3', 'S4'], { message: 'Sévérité invalide.' })
  severity?: string;

  /** Identifiant UUIDv7 de la nouvelle catégorie d'incident. */
  @ApiPropertyOptional({
    description: 'UUID de la nouvelle catégorie',
    example: '018b3d6f-7e8c-7123-89ab-cdef01234567',
  })
  @IsOptional()
  @IsUUID('all', { message: "L'ID de la catégorie doit être un UUID valide." })
  categoryId?: string;

  /** Étiquettes (tags) de classement associées au ticket. */
  @ApiPropertyOptional({ description: 'Tags ou mots-clés séparés par des virgules', example: 'fiber,urgent,router' })
  @IsOptional()
  @IsString()
  tags?: string;
}
