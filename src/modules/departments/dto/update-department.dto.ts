/**
 * ============================================================================
 * FICHIER : src/modules/departments/dto/update-department.dto.ts
 * RÔLE : DTO de validation pour la mise à jour partielle d'un département.
 * EXPLICATION :
 * Ce DTO permet de modifier facultativement le nom ou la description d'un département (PATCH /departments/:id) :
 * 1. `name` : Nouveau nom du département (max 100 caractères).
 * 2. `description` : Nouvelle description facultative.
 * ============================================================================
 */

import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, MaxLength, IsOptional } from 'class-validator';

/**
 * Objet DTO de mise à jour d'un département.
 */
export class UpdateDepartmentDto {
  /** Nouveau nom du département (facultatif, max 100 caractères). */
  @ApiPropertyOptional({ description: 'Nouveau nom du département', example: 'Network Operations Center' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  /** Nouvelle description du département (facultative). */
  @ApiPropertyOptional({ description: 'Nouvelle description du département' })
  @IsOptional()
  @IsString()
  description?: string;
}
