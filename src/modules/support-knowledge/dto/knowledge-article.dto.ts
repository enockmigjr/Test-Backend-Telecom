import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const LANGUAGES = ['fr', 'en'] as const;
const STATUSES = ['DRAFT', 'PUBLISHED', 'ARCHIVED'] as const;

export class CreateKnowledgeArticleDto {
  @ApiProperty({ example: 'coupure-internet' })
  @IsString()
  @MinLength(3)
  @MaxLength(160)
  @Matches(/^[a-z0-9][a-z0-9-]{1,158}[a-z0-9]$/, {
    message: 'Le slug doit faire 3 à 160 caractères et ne contenir que des lettres minuscules, chiffres et tirets.',
  })
  slug: string;

  @ApiProperty({ example: 'Coupure d’accès internet' })
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  summary?: string;

  @ApiProperty({ description: 'Contenu éditorial, explicitement public.' })
  @IsString()
  @MinLength(10)
  content: string;

  @ApiPropertyOptional({ enum: LANGUAGES, default: 'fr' })
  @IsOptional()
  @IsIn(LANGUAGES)
  language?: string;

  @ApiPropertyOptional({ type: [String], description: 'Intégrations autorisées à servir cet article.' })
  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  integrationIds?: string[];
}

export class UpdateKnowledgeArticleDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  summary?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(10)
  content?: string;

  @ApiPropertyOptional({ enum: STATUSES })
  @IsOptional()
  @IsIn(STATUSES)
  status?: (typeof STATUSES)[number];

  @ApiPropertyOptional({ enum: LANGUAGES })
  @IsOptional()
  @IsIn(LANGUAGES)
  language?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  integrationIds?: string[];

  @ApiPropertyOptional({ description: 'Motif conservé dans l’historique des versions.' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  note?: string;
}

export class KnowledgeQueryDto {
  @ApiPropertyOptional({ enum: STATUSES })
  @IsOptional()
  @IsIn(STATUSES)
  status?: (typeof STATUSES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  integrationId?: string;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class PublicKnowledgeSearchQueryDto {
  @ApiProperty({ description: 'Termes de recherche.' })
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  q: string;

  @ApiPropertyOptional({ default: 5, minimum: 1, maximum: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number;
}
