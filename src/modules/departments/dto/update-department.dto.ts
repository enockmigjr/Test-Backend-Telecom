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
import {
  IsString,
  MaxLength,
  IsOptional,
  IsBoolean,
  IsIn,
  IsInt,
  Min,
  IsObject,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ASSIGNMENT_STRATEGIES } from './create-department.dto';

/** Pondération de charge optionnelle par priorité et sévérité. */
class WorkloadWeightsDto {
  @ApiPropertyOptional({ description: 'Poids par priorité (LOW, MEDIUM, HIGH, CRITICAL)', example: { HIGH: 3 } })
  @IsOptional()
  @IsObject()
  priority?: Record<string, number>;

  @ApiPropertyOptional({ description: 'Poids par sévérité (S1 à S4)', example: { S1: 5 } })
  @IsOptional()
  @IsObject()
  severity?: Record<string, number>;
}

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

  /** Active ou désactive l'assignation automatique pour ce département. */
  @ApiPropertyOptional({ description: "Active l'assignation automatique", example: true })
  @IsOptional()
  @IsBoolean()
  autoAssignmentEnabled?: boolean;

  /** Algorithme d'assignation utilisé par le moteur de routage. */
  @ApiPropertyOptional({
    description: "Algorithme d'assignation (LEAST_LOADED par défaut, ROUND_ROBIN alternatif)",
    enum: ASSIGNMENT_STRATEGIES,
  })
  @IsOptional()
  @IsIn(ASSIGNMENT_STRATEGIES, { message: "Stratégie d'assignation invalide." })
  assignmentStrategy?: (typeof ASSIGNMENT_STRATEGIES)[number];

  /** Charge maximale d'un agent avant exclusion du routage. */
  @ApiPropertyOptional({ description: 'Charge maximale par agent', example: 100 })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxWorkloadPerAgent?: number;

  /** Pondération de la charge par priorité et sévérité. */
  @ApiPropertyOptional({ description: 'Pondération de la charge (priorité / sévérité)', type: WorkloadWeightsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => WorkloadWeightsDto)
  workloadWeights?: WorkloadWeightsDto;
}
