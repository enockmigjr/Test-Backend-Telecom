import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * DTO pour les transitions PENDING_CUSTOMER et PENDING_THIRD_PARTY.
 */
export class PendingTicketDto {
  @ApiPropertyOptional({
    description: 'Raison de la mise en attente',
    example: 'En attente de confirmation du client pour planifier intervention.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
