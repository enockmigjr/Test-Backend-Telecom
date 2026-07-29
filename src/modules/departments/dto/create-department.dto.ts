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
import { IsString, MaxLength, IsOptional } from 'class-validator';

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
}
