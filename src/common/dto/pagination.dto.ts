import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO commun pour la pagination.
 * Utilisable par tous les endpoints de liste.
 */
export class PaginationDto {
  @ApiPropertyOptional({ description: 'Numéro de la page (commence à 1)', default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: "Nombre d'éléments par page", default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ description: 'Champ de tri', default: 'createdAt' })
  @IsOptional()
  sort?: string = 'createdAt';

  @ApiPropertyOptional({ description: 'Ordre de tri', default: 'desc', enum: ['asc', 'desc'] })
  @IsOptional()
  order?: 'asc' | 'desc' = 'desc';
}
