/**
 * ============================================================================
 * FICHIER : src/modules/tickets/services/ticket-number.service.ts
 * RÔLE : Service de génération concourante et sécurisée des références uniques d'incidents.
 * EXPLICATION :
 * Ce service génère la référence lisible d'un ticket au format standardisé `INC-AAAA-NNNNNN` (ex: `INC-2026-000042`) :
 * 1. Séquence PostgreSQL `ticket_number_seq` (`SELECT nextval(...)`) : Garantit l'unicité stricte sans conflit de concurrence lors de la création simultanée de plusieurs tickets.
 * 2. Remplissage avec zéros non significatifs (`padStart(6, '0')`) pour maintenir un format fixe sur 6 chiffres.
 * ============================================================================
 */

import { Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DrizzleProvider } from '../../../database/drizzle.provider';

/**
 * Service de génération des numéros de ticket au format ISO/Télécom.
 * Format : INC-AAAA-NNNNNN (ex: INC-2026-000001)
 */
@Injectable()
export class TicketNumberService {
  constructor(private readonly drizzle: DrizzleProvider) {}

  /**
   * Génère le prochain numéro d'incident séquentiel pour l'année en cours.
   *
   * @returns Référence unique au format INC-AAAA-NNNNNN.
   */
  async generate(): Promise<string> {
    const year = new Date().getFullYear();

    // Utiliser une séquence PostgreSQL atomique pour éviter les collisions en forte concurrence
    const result = await this.drizzle.db.execute<{ nextval: number }>(
      sql`SELECT nextval('ticket_number_seq') AS nextval`,
    );

    const sequenceValue = result[0]?.nextval || 1;
    const paddedNumber = String(sequenceValue).padStart(6, '0');

    return `INC-${year}-${paddedNumber}`;
  }
}
