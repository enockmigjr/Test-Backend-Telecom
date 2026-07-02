import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * DTO pour resoudre un ticket.
 * L'agent peut fournir un resume de resolution.
 */
export class ResolveTicketDto {
  @ApiPropertyOptional({
    description: 'Resume de la resolution (optionnel mais recommande)',
    example: 'Fibre optique reparee sur le noeud principal. Retablissement du service a 14h32.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  resolutionSummary?: string;
}
