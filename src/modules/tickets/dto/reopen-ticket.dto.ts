import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, MinLength, MaxLength } from 'class-validator';

/**
 * DTO pour reouvrir un ticket.
 * La raison est obligatoire pour la tracabilite.
 */
export class ReopenTicketDto {
  @ApiProperty({
    description: 'Raison de la reouverture (obligatoire pour la tracabilite)',
    example: 'Le client signale que le probleme persiste malgre la cloture.',
    minLength: 10,
  })
  @IsString()
  @MinLength(10, { message: 'La raison de reouverture doit faire au moins 10 caracteres.' })
  @MaxLength(500)
  reason: string;

  @ApiPropertyOptional({ description: 'Notes supplementaires' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
