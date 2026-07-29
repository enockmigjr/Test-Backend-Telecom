/**
 * ============================================================================
 * FICHIER : src/modules/settings/dto/update-setting.dto.ts
 * RÔLE : DTO de validation pour la modification dynamique d'un paramètre système.
 * EXPLICATION :
 * Ce DTO valide la mise à jour des paramètres de configuration globale (PUT /settings/:key) :
 * 1. `value` : Valeur sous forme de chaîne de caractères (ex: heures d'ouverture '08:00-18:00', durée de clôture '48').
 * 2. `description` : Explication ou justification administrative facultative de la modification.
 * ============================================================================
 */

import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Objet DTO de mise à jour d'une clé de configuration système.
 */
export class UpdateSettingDto {
  /** Nouvelle valeur du paramètre système (obligatoire). */
  @ApiProperty({ description: 'Valeur de la configuration', example: '10' })
  @IsString()
  @IsNotEmpty()
  value: string;

  /** Description ou justification optionnelle du changement. */
  @ApiProperty({
    description: 'Description optionnelle',
    example: 'Nouvelle limite de tickets simultanés par agent',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;
}
