import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, IsISO8601, IsIn, MaxLength } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

const TICKET_STATUSES = [
  'NEW',
  'ASSIGNED',
  'IN_PROGRESS',
  'PENDING_CUSTOMER',
  'PENDING_THIRD_PARTY',
  'RESOLVED',
  'CLOSED',
  'REOPENED',
  'CANCELLED',
] as const;
const TICKET_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
const TICKET_SEVERITIES = ['S1', 'S2', 'S3', 'S4'] as const;

export class SearchTicketsDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Filtrer par statut',
    enum: TICKET_STATUSES,
  })
  @IsOptional()
  @IsString()
  @IsIn(TICKET_STATUSES)
  status?: (typeof TICKET_STATUSES)[number];

  @ApiPropertyOptional({ description: 'Filtrer par priorité', enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] })
  @IsOptional()
  @IsString()
  @IsIn(TICKET_PRIORITIES)
  priority?: (typeof TICKET_PRIORITIES)[number];

  @ApiPropertyOptional({ description: 'Filtrer par sévérité', enum: ['S1', 'S2', 'S3', 'S4'] })
  @IsOptional()
  @IsString()
  @IsIn(TICKET_SEVERITIES)
  severity?: (typeof TICKET_SEVERITIES)[number];

  @ApiPropertyOptional({ description: 'Filtrer par catégorie (UUID)' })
  @IsOptional()
  @IsUUID('all')
  categoryId?: string;

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
  @MaxLength(200)
  search?: string;

  @ApiPropertyOptional({ description: 'Date de début (ISO 8601)' })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({ description: 'Date de fin (ISO 8601)' })
  @IsOptional()
  @IsISO8601()
  to?: string;

  @ApiPropertyOptional({ enum: ['createdAt', 'updatedAt', 'priority', 'severity', 'status', 'ticketNumber'] })
  @IsOptional()
  @IsIn(['createdAt', 'updatedAt', 'priority', 'severity', 'status', 'ticketNumber'])
  declare sort?: 'createdAt' | 'updatedAt' | 'priority' | 'severity' | 'status' | 'ticketNumber';

  @ApiPropertyOptional({ enum: ['asc', 'desc'] })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  declare order?: 'asc' | 'desc';
}
