/**
 * ============================================================================
 * FICHIER : src/modules/tickets/dto/assign-ticket.dto.ts
 * RÔLE : DTO de validation pour l'assignation ou la réassignation d'un ticket.
 * EXPLICATION :
 * Ce DTO définit et valide les paramètres transmis lors de l'attribution d'un ticket d'incident (POST /tickets/:id/assign) :
 * 1. `userId` : UUIDv7 de l'agent ou technicien à qui est confié le traitement du ticket.
 * 2. `reason` : Motif facultatif expliquant la décision d'assignation ou de réaffectation.
 * ============================================================================
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID, IsString, IsOptional } from 'class-validator';

/**
 * Objet DTO d'assignation d'un ticket à un agent.
 */
export class AssignTicketDto {
  /** Identifiant UUIDv7 de l'agent destinataire de l'assignation. */
  @ApiProperty({ description: "ID de l'utilisateur cible (UUID)", example: '018b3d6f-7e8c-7123-89ab-cdef01234567' })
  @IsUUID('all', { message: "L'identifiant de l'agent doit être un UUID valide." })
  userId: string;

  /** Raison ou justification facultative de l'assignation. */
  @ApiPropertyOptional({
    description: "Raison de l'assignation",
    example: 'Compétence technique requise sur les équipements Cisco.',
  })
  @IsOptional()
  @IsString()
  reason?: string;
}
