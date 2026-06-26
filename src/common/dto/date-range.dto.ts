import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsISO8601 } from 'class-validator';

/**
 * DTO commun pour les filtres par plage de dates.
 * Utilisé par les endpoints dashboard.
 */
export class DateRangeDto {
  @ApiPropertyOptional({
    description: 'Date de début (ISO 8601)',
    example: '2026-01-01T00:00:00Z',
  })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({
    description: 'Date de fin (ISO 8601)',
    example: '2026-06-23T23:59:59Z',
  })
  @IsOptional()
  @IsISO8601()
  to?: string;
}
