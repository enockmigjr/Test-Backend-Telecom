/**
 * ============================================================================
 * FICHIER : src/modules/categories/dto/create-category.dto.ts
 * RÔLE : DTOs de validation pour la création et la modification des catégories de tickets.
 * EXPLICATION :
 * Ce module définit la structure des catégories d'incidents (ex: NETWORK, BILLING, TECHNICAL) :
 * 1. `name` : Nom unique de la catégorie.
 * 2. `description` : Description détaillée facultative.
 * 3. `targetRole` : Rôle d'agent cible (ex: 'NOC_ENGINEER', 'BILLING_AGENT') utilisé par le moteur d'auto-assignation
 *    pour aiguiller automatiquement les tickets créés vers l'équipe compétente.
 * ============================================================================
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MaxLength, IsOptional, IsIn, IsArray, ArrayUnique } from 'class-validator';

/** Liste des rôles d'agents opérationnels éligibles à l'auto-assignation ciblée par catégorie. */
const TARGET_AGENT_ROLES = [
  'CUSTOMER_SERVICE_AGENT',
  'NOC_ENGINEER',
  'BILLING_AGENT',
  'TECHNICAL_SUPPORT_ENGINEER',
  'FIELD_TECHNICIAN',
] as const;

/**
 * DTO de création d'une nouvelle catégorie d'incidents (POST /categories).
 */
export class CreateCategoryDto {
  /** Nom unique de la catégorie (ex: 'NETWORK', 'BILLING'). */
  @ApiProperty({ description: 'Nom unique de la catégorie', example: 'NETWORK' })
  @IsString({ message: 'Le nom de la catégorie doit être une chaîne de caractères.' })
  @IsNotEmpty({ message: 'Le nom de la catégorie est obligatoire.' })
  @MaxLength(100, { message: 'Le nom ne peut pas dépasser 100 caractères.' })
  name: string;

  /** Description facultative de la catégorie. */
  @ApiPropertyOptional({ description: 'Description facultative de la catégorie' })
  @IsOptional()
  @IsString()
  description?: string;

  /** Rôle d'agent spécialisé ciblé par l'auto-assignation pour cette catégorie. */
  @ApiPropertyOptional({
    description: "Rôle d'agent ciblé par cette catégorie pour l'auto-assignation",
    example: 'NOC_ENGINEER',
  })
  @IsOptional()
  @IsString()
  @IsIn(TARGET_AGENT_ROLES, { message: "Rôle d'agent cible invalide." })
  targetRole?: (typeof TARGET_AGENT_ROLES)[number];

  /** Un ou plusieurs rôles d'agents spécialisés ciblés par l'auto-assignation. */
  @ApiPropertyOptional({
    description: "Rôles d'agents ciblés par cette catégorie pour l'auto-assignation",
    example: ['NOC_ENGINEER', 'TECHNICAL_SUPPORT_ENGINEER'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique({ message: "Les rôles d'agents cibles doivent être uniques." })
  @IsIn(TARGET_AGENT_ROLES, { each: true, message: "Rôle d'agent cible invalide." })
  targetRoles?: (typeof TARGET_AGENT_ROLES)[number][];
}

/**
 * DTO de mise à jour partielle d'une catégorie d'incidents (PATCH /categories/:id).
 */
export class UpdateCategoryDto {
  /** Nouveau nom unique de la catégorie (facultatif). */
  @ApiPropertyOptional({ description: 'Nouveau nom unique de la catégorie', example: 'NETWORK_V2' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  /** Nouvelle description facultative. */
  @ApiPropertyOptional({ description: 'Nouvelle description facultative' })
  @IsOptional()
  @IsString()
  description?: string;

  /** Nouveau rôle d'agent ciblé par l'auto-assignation (facultatif). */
  @ApiPropertyOptional({ description: "Nouveau rôle d'agent ciblé", example: 'NOC_ENGINEER' })
  @IsOptional()
  @IsString()
  @IsIn(TARGET_AGENT_ROLES, { message: "Rôle d'agent cible invalide." })
  targetRole?: (typeof TARGET_AGENT_ROLES)[number];

  /** Nouveaux rôles d'agents ciblés par l'auto-assignation (facultatif). */
  @ApiPropertyOptional({
    description: "Rôles d'agents ciblés par cette catégorie pour l'auto-assignation",
    example: ['NOC_ENGINEER', 'TECHNICAL_SUPPORT_ENGINEER'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique({ message: "Les rôles d'agents cibles doivent être uniques." })
  @IsIn(TARGET_AGENT_ROLES, { each: true, message: "Rôle d'agent cible invalide." })
  targetRoles?: (typeof TARGET_AGENT_ROLES)[number][];
}
