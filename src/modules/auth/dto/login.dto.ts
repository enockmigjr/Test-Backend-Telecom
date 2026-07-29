/**
 * ============================================================================
 * FICHIER : src/modules/auth/dto/login.dto.ts
 * RÔLE : DTO de validation pour l'authentification initiale par identifiants (Email + Mot de passe).
 * EXPLICATION :
 * Ce DTO valide la tentative de connexion d'un employé (POST /auth/login) :
 * 1. `email` : Adresse email professionnelle valide.
 * 2. `password` : Mot de passe vérifié par l'algorithme de hachage sécurisé Argon2id.
 * 3. En cas de succès, génère la paire de jetons JWT (AccessToken + RefreshToken).
 * ============================================================================
 */

import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

/**
 * Objet DTO de connexion utilisateur par identifiants.
 */
export class LoginDto {
  /** Adresse email professionnelle de l'utilisateur. */
  @ApiProperty({
    description: "Adresse email de l'utilisateur",
    example: 'admin@telecom.local',
    format: 'email',
    minLength: 5,
  })
  @IsEmail({}, { message: "L'adresse email fournie n'est pas valide." })
  email: string;

  /** Mot de passe secret transmis pour vérification Argon2id. */
  @ApiProperty({
    description: 'Mot de passe',
    example: 'Admin@1234',
    minLength: 8,
    format: 'password',
  })
  @IsString()
  @MinLength(1, { message: 'Le mot de passe est requis.' })
  password: string;
}
