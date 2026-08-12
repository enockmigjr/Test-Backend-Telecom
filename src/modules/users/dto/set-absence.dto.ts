/**
 * DTO de déclaration d'absence d'un agent (auto-déclaration courte, admin pour la prolongée).
 */
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional } from 'class-validator';

export class SetAbsenceDto {
  /** Fin d'absence (ISO 8601) ; vide pour annuler. */
  @ApiPropertyOptional({ description: "Fin d'absence (ISO 8601) ; vide pour annuler", example: '2026-08-20T18:00:00.000Z' })
  @IsOptional()
  @IsDateString({}, { message: "La fin d'absence doit être une date ISO valide." })
  absenceEndsAt?: string | null;
}
