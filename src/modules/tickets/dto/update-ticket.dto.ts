import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, MaxLength, IsIn } from 'class-validator';

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

  @ApiPropertyOptional({ description: 'Nouvelle priorité', enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] })
  @IsOptional()
  @IsString()
  @IsIn(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
  priority?: string;

  @ApiPropertyOptional({ description: 'Nouvelle sévérité', enum: ['S1', 'S2', 'S3', 'S4'] })
  @IsOptional()
  @IsString()
  @IsIn(['S1', 'S2', 'S3', 'S4'])
  severity?: string;

  @ApiPropertyOptional({
    description: 'Nouvelle catégorie',
    enum: ['NETWORK', 'BILLING', 'TECHNICAL', 'HARDWARE', 'SOFTWARE', 'OTHER'],
  })
  @IsOptional()
  @IsString()
  @IsIn(['NETWORK', 'BILLING', 'TECHNICAL', 'HARDWARE', 'SOFTWARE', 'OTHER'])
  category?: string;

  @ApiPropertyOptional({ description: 'Tags' })
  @IsOptional()
  @IsString()
  tags?: string;
}
