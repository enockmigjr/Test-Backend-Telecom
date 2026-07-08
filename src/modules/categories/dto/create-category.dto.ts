import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MaxLength, IsOptional } from 'class-validator';

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
  targetRole?: string;
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
  targetRole?: string;
}
