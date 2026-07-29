/**
 * ============================================================================
 * FICHIER : src/modules/tickets/dto/pending-ticket.dto.ts
 * RÔLE : DTO de validation pour la mise en attente d'un ticket (PENDING_CUSTOMER / PENDING_THIRD_PARTY).
 * EXPLICATION :
 * Ce DTO valide la mise en pause temporaire d'un ticket (POST /tickets/:id/pending-customer ou pending-third-party) :
 * 1. `reason` : Explication du motif de suspension (ex: attente de réponse client ou livraison pièce sous-traitant).
 * 2. La mise en attente **suspend automatiquement le décompte SLA** de résolution pour ne pas pénaliser l'agent.
 * ============================================================================
 */

import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * DTO pour les transitions vers les statuts de mise en attente PENDING_CUSTOMER et PENDING_THIRD_PARTY.
 */
export class PendingTicketDto {
  /** Raison facultative de la mise en attente (max 500 caractères). */
  @ApiPropertyOptional({
    description: 'Raison de la mise en attente',
    example: 'En attente de confirmation du client pour planifier l intervention.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
