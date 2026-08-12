/**
 * ============================================================================
 * FICHIER : src/modules/departments/dto/create-department.dto.ts
 * RÔLE : DTO de validation pour la création d'un nouveau département télécom.
 * EXPLICATION :
 * Ce DTO définit et valide les informations de création d'un département (POST /departments) :
 * 1. `name` : Nom unique du département (ex: 'NOC', 'Billing', 'Field Operations').
 * 2. `description` : Description facultative du rôle du service.
 * ============================================================================
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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

/** Stratégie d'assignation automatique supportée par le moteur de routage. */
export const ASSIGNMENT_STRATEGIES = ['ROUND_ROBIN', 'LEAST_LOADED'] as const;

/** Pondération de charge optionnelle par priorité et sévérité. */
class WorkloadWeightsDto {
  @ApiPropertyOptional({
    description: 'Poids par priorité (LOW, MEDIUM, HIGH, CRITICAL)',
    example: { HIGH: 3 },
    additionalProperties: { type: 'number' },
  })
  @IsOptional()
  @IsObject()
  priority?: Record<string, number>;

  @ApiPropertyOptional({
    description: 'Poids par sévérité (S1 à S4)',
    example: { S1: 5 },
    additionalProperties: { type: 'number' },
  })
  @IsOptional()
  @IsObject()
  severity?: Record<string, number>;
}

/**
 * Objet DTO de création d'un département.
 */
export class CreateDepartmentDto {
  /** Nom unique du département (max 100 caractères). */
  @ApiProperty({ description: 'Nom du département', example: 'Customer Care' })
  @IsString({ message: 'Le nom du département est requis.' })
  @MaxLength(100, { message: 'Le nom du département ne peut pas dépasser 100 caractères.' })
  name: string;

  /** Description du département (facultative). */
  @ApiPropertyOptional({
    description: 'Description du département',
    example: 'Service client — première ligne de support',
  })
  @IsOptional()
  @IsString()
  description?: string;

  /** Active ou désactive l'assignation automatique pour ce département. */
  @ApiPropertyOptional({ description: "Active l'assignation automatique", example: true, default: true })
  @IsOptional()
  @IsBoolean()
  autoAssignmentEnabled?: boolean;

  /** Algorithme d'assignation utilisé par le moteur de routage. */
  @ApiPropertyOptional({
    description: "Algorithme d'assignation (LEAST_LOADED par défaut, ROUND_ROBIN alternatif)",
    enum: ASSIGNMENT_STRATEGIES,
    default: 'LEAST_LOADED',
  })
  @IsOptional()
  @IsIn(ASSIGNMENT_STRATEGIES, { message: "Stratégie d'assignation invalide." })
  assignmentStrategy?: (typeof ASSIGNMENT_STRATEGIES)[number];

  /** Charge maximale d'un agent avant exclusion du routage. */
  @ApiPropertyOptional({ description: 'Charge maximale par agent', example: 100, default: 100 })
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
