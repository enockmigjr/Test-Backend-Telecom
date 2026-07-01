import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, IsISO8601 } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class SearchTicketsDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Filtrer par statut',
    enum: [
      'NEW',
      'ASSIGNED',
      'IN_PROGRESS',
      'PENDING_CUSTOMER',
      'PENDING_THIRD_PARTY',
      'RESOLVED',
      'CLOSED',
      'REOPENED',
      'CANCELLED',
    ],
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'Filtrer par priorité', enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] })
  @IsOptional()
  @IsString()
  priority?: string;

  @ApiPropertyOptional({ description: 'Filtrer par sévérité', enum: ['S1', 'S2', 'S3', 'S4'] })
  @IsOptional()
  @IsString()
  severity?: string;

  @ApiPropertyOptional({ description: 'Filtrer par catégorie' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: 'Filtrer par agent assigné (UUID)' })
  @IsOptional()
  @IsUUID('all')
  assignedTo?: string;

  @ApiPropertyOptional({ description: 'Filtrer par équipe assignée (UUID)' })
  @IsOptional()
  @IsUUID('all')
  assignedTeam?: string;

  @ApiPropertyOptional({ description: 'Filtrer par département propriétaire (UUID)' })
  @IsOptional()
  @IsUUID('all')
  departmentId?: string;

  @ApiPropertyOptional({ description: 'Recherche texte (titre, description, numéro, client)' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Date de début (ISO 8601)' })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({ description: 'Date de fin (ISO 8601)' })
  @IsOptional()
  @IsISO8601()
  to?: string;
}
