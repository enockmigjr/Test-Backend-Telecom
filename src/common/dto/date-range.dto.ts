/**
 * ============================================================================
 * FICHIER : src/common/dto/date-range.dto.ts
 * RÔLE : DTO réutilisable de filtrage par intervalle temporel (`from` -> `to`).
 * EXPLICATION :
 * Ce DTO valide les bornes de dates transmises en paramètres de requête (Query Params) pour les tableaux de bord et rapports :
 * 1. `from` : Horodatage ISO-8601 de début d'analyse (ex: '2026-01-01T00:00:00Z').
 * 2. `to` : Horodatage ISO-8601 de fin d'analyse (ex: '2026-12-31T23:59:59Z').
 * ============================================================================
 */

import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsISO8601 } from 'class-validator';

/**
 * DTO de sélection d'une période temporelle.
 */
export class DateRangeDto {
  /** Date de début au format international ISO-8601 (facultatif). */
  @ApiPropertyOptional({
    description: 'Date de début (ISO 8601)',
    example: '2026-01-01T00:00:00Z',
  })
  @IsOptional()
  @IsISO8601({}, { message: 'La date de début doit être au format ISO 8601.' })
  from?: string;

  /** Date de fin au format international ISO-8601 (facultatif). */
  @ApiPropertyOptional({
    description: 'Date de fin (ISO 8601)',
    example: '2026-06-23T23:59:59Z',
  })
  @IsOptional()
  @IsISO8601({}, { message: 'La date de fin doit être au format ISO 8601.' })
  to?: string;
}
