import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

const CATEGORIES = ['NETWORK', 'BILLING', 'TECHNICAL', 'HARDWARE', 'SOFTWARE', 'OTHER'] as const;
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;

export class CreateSlaPolicyDto {
  @ApiProperty({
    description: 'Catégorie de tickets couverte par cette politique',
    enum: CATEGORIES,
    example: 'NETWORK',
  })
  @IsString()
  @IsIn(CATEGORIES, { message: 'Catégorie invalide.' })
  category: string;

  @ApiProperty({
    description: 'Priorité couverte par cette politique',
    enum: PRIORITIES,
    example: 'HIGH',
  })
  @IsString()
  @IsIn(PRIORITIES, { message: 'Priorité invalide.' })
  priority: string;

  @ApiProperty({
    description: 'Délai maximum de première réponse en minutes',
    example: 30,
    minimum: 1,
  })
  @IsInt({ message: 'Le délai de première réponse doit être un entier.' })
  @Min(1)
  firstResponseMinutes: number;

  @ApiProperty({
    description: 'Délai maximum de résolution en minutes',
    example: 240,
    minimum: 1,
  })
  @IsInt({ message: 'Le délai de résolution doit être un entier.' })
  @Min(1)
  resolutionMinutes: number;
}

export class UpdateSlaPolicyDto {
  @ApiPropertyOptional({
    description: 'Nouveau délai de première réponse en minutes',
    example: 45,
    minimum: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  firstResponseMinutes?: number;

  @ApiPropertyOptional({
    description: 'Nouveau délai de résolution en minutes',
    example: 480,
    minimum: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  resolutionMinutes?: number;
}
