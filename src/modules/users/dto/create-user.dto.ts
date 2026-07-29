/**
 * ============================================================================
 * FICHIER : src/modules/users/dto/create-user.dto.ts
 * RÔLE : DTO de validation pour la création d'un nouvel utilisateur par un administrateur.
 * EXPLICATION :
 * Ce DTO définit et valide les champs requis pour créer un compte employé dans le système :
 * 1. `email` : Adresse email professionnelle unique (format email valide).
 * 2. `firstName` & `lastName` : Prénom et nom de l'agent (max 100 caractères).
 * 3. `role` : Rôle RBAC parmi les 7 rôles prédéfinis du système télécom.
 * 4. `departmentId` : Identifiant UUIDv7 du département auquel est rattaché l'utilisateur.
 * ============================================================================
 */

import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, IsUUID, IsIn, MaxLength } from 'class-validator';

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
 * Objet DTO de création d'un utilisateur transmise dans le corps des requêtes POST /users.
 */
export class CreateUserDto {
  /** Adresse email professionnelle unique de l'utilisateur. */
  @ApiProperty({ description: 'Adresse email professionnelle', example: 'agent@telecom.local', format: 'email' })
  @IsEmail({}, { message: "L'adresse email fournie n'est pas valide." })
  email: string;

  /** Prénom de l'utilisateur (max 100 caractères). */
  @ApiProperty({ description: 'Prénom', example: 'Jean' })
  @IsString({ message: 'Le prénom est requis.' })
  @MaxLength(100)
  firstName: string;

  /** Nom de famille de l'utilisateur (max 100 caractères). */
  @ApiProperty({ description: 'Nom de famille', example: 'Dupont' })
  @IsString({ message: 'Le nom de famille est requis.' })
  @MaxLength(100)
  lastName: string;

  /** Rôle d'accès RBAC attribué à l'utilisateur. */
  @ApiProperty({ description: 'Rôle RBAC', enum: VALID_ROLES, example: 'CUSTOMER_SERVICE_AGENT' })
  @IsString()
  @IsIn(VALID_ROLES, { message: 'Rôle invalide.' })
  role: string;

  /** Identifiant UUID du département de rattachement. */
  @ApiProperty({ description: 'ID du département (UUID)', example: '018b3d6f-7e8c-7123-89ab-cdef01234567' })
  @IsUUID('all', { message: "L'identifiant du département doit être un UUID valide." })
  departmentId: string;
}
