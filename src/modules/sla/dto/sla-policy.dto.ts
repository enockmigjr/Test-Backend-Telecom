/**
 * ============================================================================
 * FICHIER : src/modules/sla/dto/sla-policy.dto.ts
 * RÔLE : DTOs de validation pour la création et la modification des politiques SLA.
 * EXPLICATION :
 * Ce module définit les contrats SLA (Service Level Agreement) de la plateforme :
 * 1. Associe une catégorie d'incident et un niveau de priorité (`LOW` à `CRITICAL`).
 * 2. `firstResponseMinutes` : Temps imparti en minutes pour la prise en charge initiale.
 * 3. `resolutionMinutes` : Temps maximal autorisé en minutes pour la résolution complète du ticket.
 * ============================================================================
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID, IsInt, IsOptional, IsString, IsIn, Min } from 'class-validator';

/** Liste des 4 niveaux de priorité gérés par le moteur SLA. */
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;

/**
 * DTO de création d'une politique SLA (POST /sla-policies).
 */
export class CreateSlaPolicyDto {
  /** Identifiant UUIDv7 de la catégorie couverte par la règle SLA. */
  @ApiProperty({
    description: 'UUID de la catégorie couverte par cette politique',
    example: '018b3d6f-7e8c-7123-89ab-cdef01234567',
  })
  @IsUUID('all', { message: "L'ID de la catégorie doit être un UUID valide." })
  categoryId: string;

  /** Niveau de priorité du ticket auquel s'applique la politique SLA. */
  @ApiProperty({
    description: 'Priorité couverte par cette politique',
    enum: PRIORITIES,
    example: 'HIGH',
  })
  @IsString()
  @IsIn(PRIORITIES, { message: 'Priorité invalide.' })
  priority: string;

  /** Objectif maximum de première réponse exprimé en minutes (ex: 30 min pour HIGH). */
  @ApiProperty({
    description: 'Délai maximum de première réponse en minutes',
    example: 30,
    minimum: 1,
  })
  @IsInt({ message: 'Le délai de première réponse doit être un entier.' })
  @Min(1)
  firstResponseMinutes: number;

  /** Objectif maximum de résolution finale exprimé en minutes (ex: 240 min = 4 heures). */
  @ApiProperty({
    description: 'Délai maximum de résolution en minutes',
    example: 240,
    minimum: 1,
  })
  @IsInt({ message: 'Le délai de résolution doit être un entier.' })
  @Min(1)
  resolutionMinutes: number;
}

/**
 * DTO de mise à jour partielle des objectifs de temps d'une politique SLA (PATCH /sla-policies/:id).
 */
export class UpdateSlaPolicyDto {
  /** Nouveau délai cible de première réponse en minutes (facultatif). */
  @ApiPropertyOptional({
    description: 'Nouveau délai de première réponse en minutes',
    example: 45,
    minimum: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  firstResponseMinutes?: number;

  /** Nouveau délai cible de résolution en minutes (facultatif). */
  @ApiPropertyOptional({
    description: 'Nouveau délai de résolution en minutes',
    example: 480,
    minimum: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  resolutionMinutes?: number;
}
