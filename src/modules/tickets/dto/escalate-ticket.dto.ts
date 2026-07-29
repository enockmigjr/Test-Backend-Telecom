/**
 * ============================================================================
 * FICHIER : src/modules/tickets/dto/escalate-ticket.dto.ts
 * RÔLE : DTO de validation pour l'escalade d'un ticket vers un niveau supérieur ou un autre service.
 * EXPLICATION :
 * Ce DTO valide le transfert d'un ticket complexe (POST /tickets/:id/escalate) :
 * 1. `userId` : Identifiant de l'expert ou superviseur récepteur.
 * 2. `departmentId` : Identifiant du département spécialisé récepteur (ex: transfert de Customer Care vers NOC).
 * 3. `reason` : Explication obligatoire ou recommandée de l'escalade.
 * ============================================================================
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID, IsString, IsOptional } from 'class-validator';

/**
 * Objet DTO d'escalade d'un ticket.
 */
export class EscalateTicketDto {
  /** Identifiant UUIDv7 de l'expert ou du superviseur cible. */
  @ApiProperty({ description: "ID de l'utilisateur cible (UUID)", example: '018b3d6f-7e8c-7123-89ab-cdef01234567' })
  @IsUUID('all', { message: "L'identifiant de l'utilisateur cible doit être un UUID valide." })
  userId: string;

  /** Identifiant UUIDv7 du département cible de l'escalade. */
  @ApiProperty({ description: 'ID du département cible (UUID)', example: '018b3d6f-7e8c-7123-89ab-cdef01234568' })
  @IsUUID('all', { message: "L'identifiant du département cible doit être un UUID valide." })
  departmentId: string;

  /** Raison ou motif détaillé de l'escalade. */
  @ApiPropertyOptional({
    description: "Raison de l'escalade",
    example: 'Panne réseau niveau 2 nécessitant une intervention sur pylône.',
  })
  @IsOptional()
  @IsString()
  reason?: string;
}
