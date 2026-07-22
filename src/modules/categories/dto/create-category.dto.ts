import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MaxLength, IsOptional, IsIn } from 'class-validator';

const TARGET_AGENT_ROLES = [
  'CUSTOMER_SERVICE_AGENT',
  'NOC_ENGINEER',
  'BILLING_AGENT',
  'TECHNICAL_SUPPORT_ENGINEER',
  'FIELD_TECHNICIAN',
] as const;

export class CreateCategoryDto {
  @ApiProperty({ description: 'Nom unique de la catégorie', example: 'NETWORK' })
  @IsString({ message: 'Le nom de la catégorie doit être une chaîne de caractères.' })
  @IsNotEmpty({ message: 'Le nom de la catégorie est obligatoire.' })
  @MaxLength(100, { message: 'Le nom ne peut pas dépasser 100 caractères.' })
  name: string;

  @ApiPropertyOptional({ description: 'Description facultative de la catégorie' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: "Rôle d'agent ciblé par cette catégorie pour l'auto-assignation",
    example: 'NOC_ENGINEER',
  })
  @IsOptional()
  @IsString()
  @IsIn(TARGET_AGENT_ROLES)
  targetRole?: (typeof TARGET_AGENT_ROLES)[number];
}

export class UpdateCategoryDto {
  @ApiPropertyOptional({ description: 'Nouveau nom unique de la catégorie', example: 'NETWORK_V2' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ description: 'Nouvelle description facultative' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: "Nouveau rôle d'agent ciblé", example: 'NOC_ENGINEER' })
  @IsOptional()
  @IsString()
  @IsIn(TARGET_AGENT_ROLES)
  targetRole?: (typeof TARGET_AGENT_ROLES)[number];
}
