import { Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DrizzleProvider } from '../../../database/drizzle.provider';

/**
 * Service de génération des numéros de ticket.
 * Format : INC-AAAA-NNNNNN (ex: INC-2026-000001)
 */
@Injectable()
export class TicketNumberService {
  constructor(private readonly drizzle: DrizzleProvider) {}

  async generate(): Promise<string> {
    const year = new Date().getFullYear();

    // Utiliser une séquence PostgreSQL pour éviter les collisions en concurrence
    const result = await this.drizzle.db.execute<{ nextval: number }>(
      sql`SELECT nextval('ticket_number_seq') AS nextval`,
    );

    const sequenceValue = result[0]?.nextval || 1;
    const paddedNumber = String(sequenceValue).padStart(6, '0');

    return `INC-${year}-${paddedNumber}`;
  }
}
