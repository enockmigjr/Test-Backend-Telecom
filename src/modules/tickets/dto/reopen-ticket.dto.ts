/**
 * ============================================================================
 * FICHIER : src/modules/tickets/dto/reopen-ticket.dto.ts
 * RÔLE : DTO de validation pour la réouverture d'un ticket résolu (REOPENED).
 * EXPLICATION :
 * Ce DTO valide les informations fournies lors de la réouverture d'un ticket d'incident (POST /tickets/:id/reopen) :
 * 1. `reason` : Raison obligatoire (min 10 caractères) justifiant la réouverture (ex: panne non résolue signalée par le client).
 * 2. `notes` : Remarques ou détails techniques complémentaires facultatifs.
 * 3. La réouverture bascule le ticket dans l'état `REOPENED` et relance son délai de traitement SLA.
 * ============================================================================
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, MinLength, MaxLength } from 'class-validator';

/**
 * DTO pour réouvrir un ticket. La raison est obligatoire pour la traçabilité.
 */
export class ReopenTicketDto {
  /** Raison obligatoire de la réouverture pour la traçabilité (10 à 500 caractères). */
  @ApiProperty({
    description: 'Raison de la réouverture (obligatoire pour la traçabilité)',
    example: 'Le client signale que le problème persiste malgré la résolution.',
    minLength: 10,
  })
  @IsString()
  @MinLength(10, { message: 'La raison de réouverture doit faire au moins 10 caractères.' })
  @MaxLength(500)
  reason: string;

  /** Notes complémentaires d'analyse facultatives. */
  @ApiPropertyOptional({ description: 'Notes supplémentaires' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
