import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export class ExternalRequesterQueryDto {
  @ApiPropertyOptional({ description: 'Filtrer par intégration de support (UUID).' })
  @IsOptional()
  @IsUUID()
  supportIntegrationId?: string;

  @ApiPropertyOptional({ description: 'Recherche insensible à la casse sur le nom affiché.' })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  search?: string;

  @ApiPropertyOptional({ enum: ['true', 'false'], description: 'Filtrer les profils anonymisés (true) ou actifs (false).' })
  @IsOptional()
  @IsIn(['true', 'false'])
  anonymized?: string;

  @ApiPropertyOptional({ description: 'Numéro de page (commence à 1).', default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ description: 'Éléments par page (max 100).', default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
