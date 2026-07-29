/**
 * ============================================================================
 * FICHIER : src/modules/auth/dto/change-password.dto.ts
 * RÔLE : DTO de validation pour la modification de mot de passe utilisateur.
 * EXPLICATION :
 * Ce DTO applique la politique de complexité des mots de passe (POST /auth/change-password) :
 * 1. `currentPassword` : Validation du mot de passe actuel avant toute modification.
 * 2. `newPassword` : Exige au moins 8 caractères comprenant 1 majuscule, 1 minuscule, 1 chiffre et 1 caractère spécial (@$!%*?&).
 * 3. Obligatoire lors du premier accès (`mustChangePassword = true`) ou lors d'un changement volontaire.
 * ============================================================================
 */

import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength, Matches } from 'class-validator';

/**
 * Objet DTO de changement de mot de passe utilisateur.
 */
export class ChangePasswordDto {
  /** Mot de passe actuel de l'utilisateur. */
  @ApiProperty({ description: 'Mot de passe actuel' })
  @IsString({ message: 'Le mot de passe actuel est requis.' })
  currentPassword: string;

  /** Nouveau mot de passe respectant les règles de complexité renforcée. */
  @ApiProperty({ description: 'Nouveau mot de passe (min 8 car., 1 maj, 1 min, 1 chiffre, 1 spécial)' })
  @IsString()
  @MinLength(8, { message: 'Le mot de passe doit contenir au moins 8 caractères.' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, {
    message: 'Le mot de passe doit contenir au moins une majuscule, une minuscule, un chiffre et un caractère spécial.',
  })
  newPassword: string;
}
