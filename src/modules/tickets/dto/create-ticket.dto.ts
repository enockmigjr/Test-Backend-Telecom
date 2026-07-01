import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsUUID, IsIn, MaxLength, IsOptional } from 'class-validator';

const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
const SEVERITIES = ['S1', 'S2', 'S3', 'S4'] as const;
const CATEGORIES = ['NETWORK', 'BILLING', 'TECHNICAL', 'HARDWARE', 'SOFTWARE', 'OTHER'] as const;

export class CreateTicketDto {
  @ApiProperty({ description: 'Titre du ticket', example: 'Coupure fibre optique secteur Nord' })
  @IsString({ message: 'Le titre du ticket est requis.' })
  @MaxLength(255, { message: 'Le titre ne peut pas dépasser 255 caractères.' })
  title: string;

  @ApiProperty({ description: "Description détaillée de l'incident" })
  @IsString({ message: 'La description du ticket est requise.' })
  description: string;

  @ApiProperty({ description: 'Priorité du ticket', enum: PRIORITIES, example: 'HIGH' })
  @IsString()
  @IsIn(PRIORITIES, { message: 'Priorité invalide.' })
  priority: string;

  @ApiProperty({ description: 'Sévérité du ticket', enum: SEVERITIES, example: 'S2' })
  @IsString()
  @IsIn(SEVERITIES, { message: 'Sévérité invalide.' })
  severity: string;

  @ApiProperty({ description: 'Catégorie du ticket', enum: CATEGORIES, example: 'NETWORK' })
  @IsString()
  @IsIn(CATEGORIES, { message: 'Catégorie invalide.' })
  category: string;

  @ApiProperty({ description: 'ID du département propriétaire', example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsUUID('all')
  departmentId: string;

  @ApiProperty({ description: "ID de l'équipe assignée", example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsUUID('all')
  assignedTeamId: string;

  @ApiPropertyOptional({ description: 'Numéro de compte client' })
  @IsOptional()
  @IsString()
  customerAccountNumber?: string;

  @ApiPropertyOptional({ description: 'Nom du client' })
  @IsOptional()
  @IsString()
  customerName?: string;

  @ApiPropertyOptional({ description: 'Contact du client' })
  @IsOptional()
  @IsString()
  customerContact?: string;

  @ApiPropertyOptional({ description: 'Tags (mots-clés séparés par des virgules)' })
  @IsOptional()
  @IsString()
  tags?: string;
}
