/**
 * ============================================================================
 * FICHIER : src/modules/tickets/dto/resolve-ticket.dto.ts
 * RÔLE : DTO de validation pour la résolution d'un ticket d'incident (RESOLVED).
 * EXPLICATION :
 * Ce DTO valide la soumission du compte-rendu de résolution par l'agent ou le technicien (POST /tickets/:id/resolve) :
 * 1. `resolutionSummary` : Résumé explicatif facultatif décrivant l'action corrective apportée (max 1000 caractères).
 * 2. La résolution fixe l'horodatage `resolvedAt` et déclenche le timer d'auto-clôture de 48h (`CLOSED`).
 * ============================================================================
 */

import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * DTO pour résoudre un ticket. L'agent peut fournir un résumé de résolution.
 */
export class ResolveTicketDto {
  /** Résumé des actions correctives de résolution (facultatif, max 1000 caractères). */
  @ApiPropertyOptional({
    description: 'Résumé de la résolution (optionnel mais recommandé)',
    example: 'Fibre optique réparée sur le nœud principal. Rétablissement du service à 14h32.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  resolutionSummary?: string;
}
