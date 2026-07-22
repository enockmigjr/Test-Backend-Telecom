import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class UpdateTicketDto {
  @ApiPropertyOptional({ description: 'Nouveau titre' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional({ description: 'Nouvelle description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] })
  @IsOptional()
  @IsIn(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
  priority?: string;

  @ApiPropertyOptional({ enum: ['S1', 'S2', 'S3', 'S4'] })
  @IsOptional()
  @IsIn(['S1', 'S2', 'S3', 'S4'])
  severity?: string;

  @ApiPropertyOptional({ description: 'UUID de la nouvelle categorie' })
  @IsOptional()
  @IsUUID('all')
  categoryId?: string;

  @ApiPropertyOptional({ description: 'Tags' })
  @IsOptional()
  @IsString()
  tags?: string;
}
