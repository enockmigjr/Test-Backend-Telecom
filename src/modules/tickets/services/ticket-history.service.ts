import { Injectable, Logger } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { DrizzleProvider } from '../../../database/drizzle.provider';
import { ticketHistory } from '../../../database/schemas';

@Injectable()
export class TicketHistoryService {
  private readonly logger = new Logger(TicketHistoryService.name);

  constructor(private readonly drizzle: DrizzleProvider) {}

  /**
   * Enregistre une action dans l'historique du ticket.
   */
  async record(
    ticketId: string,
    userId: string,
    action: string,
    oldValue?: unknown,
    newValue?: unknown,
    metadata?: unknown,
  ): Promise<void> {
    await this.drizzle.db.insert(ticketHistory).values({
      id: uuidv4(),
      ticketId,
      userId,
      action,
      oldValue: oldValue ? JSON.parse(JSON.stringify(oldValue)) : null,
      newValue: newValue ? JSON.parse(JSON.stringify(newValue)) : null,
      metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : null,
    });
  }

  /**
   * Récupère l'historique complet d'un ticket.
   */
  async getHistory(ticketId: string) {
    return this.drizzle.db
      .select()
      .from(ticketHistory)
      .where(eq(ticketHistory.ticketId, ticketId))
      .orderBy(ticketHistory.createdAt);
  }
}
