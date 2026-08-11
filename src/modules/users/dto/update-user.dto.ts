/**
 * ============================================================================
 * FICHIER : src/modules/users/dto/update-user.dto.ts
 * RÔLE : DTO de validation pour la mise à jour partielle des informations d'un utilisateur.
 * EXPLICATION :
 * Ce DTO permet de modifier facultativement un ou plusieurs champs du profil d'un employé (PATCH /users/:id) :
 * 1. `firstName` & `lastName` : Modification facultative de l'état civil.
 * 2. `role` : Modification du rôle RBAC (exige les droits ADMINISTRATOR ou SUPERVISOR).
 * 3. `departmentId` : Réaffectation à un autre département télécom.
 * ============================================================================
 */

import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsUUID, IsIn, MaxLength, IsOptional, IsBoolean, IsDateString } from 'class-validator';

/** Liste canonique des 7 rôles autorisés dans l'application. */
const VALID_ROLES = [
  'ADMINISTRATOR',
  'SUPERVISOR',
  'CUSTOMER_SERVICE_AGENT',
  'NOC_ENGINEER',
  'BILLING_AGENT',
  'TECHNICAL_SUPPORT_ENGINEER',
  'FIELD_TECHNICIAN',
] as const;

/**
 * Objet DTO de mise à jour partielle d'un compte utilisateur.
 */
export class UpdateUserDto {
  /** Prénom de l'utilisateur (facultatif). */
  @ApiPropertyOptional({ description: 'Prénom', example: 'Jean' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstName?: string;

  /** Nom de famille de l'utilisateur (facultatif). */
  @ApiPropertyOptional({ description: 'Nom de famille', example: 'Dupont' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;

  /** Rôle d'accès RBAC (facultatif). */
  @ApiPropertyOptional({ description: 'Rôle RBAC', enum: VALID_ROLES, example: 'TECHNICAL_SUPPORT_ENGINEER' })
  @IsOptional()
  @IsString()
  @IsIn(VALID_ROLES, { message: 'Rôle invalide.' })
  role?: string;

  /** Identifiant UUID du nouveau département de rattachement (facultatif). */
  @ApiPropertyOptional({ description: 'ID du département (UUID)', example: '018b3d6f-7e8c-7123-89ab-cdef01234567' })
  @IsOptional()
  @IsUUID('all', { message: "L'identifiant du département doit être un UUID valide." })
  departmentId?: string;

  /** Disponibilité de l'agent pour l'assignation (pause volontaire). */
  @ApiPropertyOptional({ description: "Disponibilité de l'agent (false = pause)", example: true })
  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;

  /** Fin d'absence (vide pour annuler une absence en cours). */
  @ApiPropertyOptional({
    description: "Fin d'absence (ISO 8601)",
    example: '2026-08-20T18:00:00.000Z',
    type: String,
    nullable: true,
  })
  @IsOptional()
  @IsDateString()
  absenceEndsAt?: string | null;
}
