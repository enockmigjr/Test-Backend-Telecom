/**
 * ============================================================================
 * FICHIER : src/modules/auth/dto/refresh.dto.ts
 * RÔLE : DTO de validation pour le renouvellement du jeton d'accès (Refresh Token Rotation).
 * EXPLICATION :
 * Ce DTO valide la demande de génération d'une nouvelle paire de jetons JWT (POST /auth/refresh) :
 * 1. `refreshToken` : Jeton de rafraîchissement opaque à usage unique.
 * 2. Le jeton présenté est consommé, révoqué en base de données et remplacé par une nouvelle paire d'accès.
 * ============================================================================
 */

import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

/**
 * Objet DTO de renouvellement de session par jeton de rafraîchissement.
 */
export class RefreshDto {
  /** Jeton de rafraîchissement à usage unique transmis dans le corps de la requête. */
  @ApiProperty({ description: 'Refresh token à usage unique' })
  @IsString({ message: 'Le refresh token est requis.' })
  refreshToken: string;
}
