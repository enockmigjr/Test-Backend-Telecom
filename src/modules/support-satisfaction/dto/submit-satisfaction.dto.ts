/**
 * DTO de soumission d'une note de satisfaction par un demandeur public.
 */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class SubmitSatisfactionDto {
  @ApiProperty({ description: 'Jeton opaque reçu par email', minLength: 32 })
  @IsString()
  token: string;

  @ApiProperty({ description: 'Note de 1 à 5', minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1, { message: 'La note doit être au moins 1.' })
  @Max(5, { message: 'La note ne peut pas dépasser 5.' })
  note: number;

  @ApiPropertyOptional({ description: 'Commentaire libre', maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000, { message: 'Le commentaire ne peut pas dépasser 2000 caractères.' })
  comment?: string;
}
