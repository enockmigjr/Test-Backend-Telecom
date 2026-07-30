/**
 * ============================================================================
 * FICHIER : src/modules/tickets/services/ticket-history.service.ts
 * RÔLE : Service de journalisation et de consultation de l'historique immuable d'un ticket.
 * EXPLICATION :
 * Ce service assure la traçabilité complète de l'ensemble des mutations subies par un incident :
 * 1. `record` : Enregistre une entrée d'historique (`TICKET_CREATED`, `STATUS_CHANGED`, `TICKET_ASSIGNED`, `PRIORITY_CHANGED`...) avec sérialisation JSON des anciens et nouveaux états.
 * 2. `getHistory` : Extrait la frise chronologique complète des événements rattachés à un ticket.
 * ============================================================================
 */

import { Injectable, Logger } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { generateUuid } from '../../../common/helpers/uuidv7.helper';
import { DrizzleProvider } from '../../../database/drizzle.provider';
import { ticketHistory } from '../../../database/schemas';
import { internalActor, TicketActor, toTicketActorColumns } from '../domain/ticket-actor';

/**
 * Service gérant la traçabilité des modifications et l'audit trail des tickets.
 */
@Injectable()
export class TicketHistoryService {
  private readonly logger = new Logger(TicketHistoryService.name);

  constructor(private readonly drizzle: DrizzleProvider) {}

  /**
   * Consigne une modification ou une action effectuée sur un ticket d'incident.
   *
   * @param ticketId UUID du ticket concerné.
   * @param userId UUID de l'utilisateur ou du compte système ayant effectué l'action.
   * @param action Libellé de l'action (ex: 'STATUS_CHANGED').
   * @param oldValue État précédent de la propriété modifiée (facultatif).
   * @param newValue Nouvel état appliqué (facultatif).
   * @param metadata Contexte ou motif complémentaire (facultatif).
   */
  async record(
    ticketId: string,
    userId: string,
    action: string,
    oldValue?: unknown,
    newValue?: unknown,
    metadata?: unknown,
  ): Promise<void> {
    return this.recordByActor(ticketId, internalActor(userId), action, oldValue, newValue, metadata);
  }

  /** Variante canonique acceptant un acteur interne, externe ou système. */
  async recordByActor(
    ticketId: string,
    actor: TicketActor,
    action: string,
    oldValue?: unknown,
    newValue?: unknown,
    metadata?: unknown,
    contextIntegrationId?: string,
  ): Promise<void> {
    const actorColumns = toTicketActorColumns(actor, contextIntegrationId);
    await this.drizzle.db.insert(ticketHistory).values({
      id: generateUuid(),
      ticketId,
      ...actorColumns,
      action,
      oldValue: oldValue ? JSON.parse(JSON.stringify(oldValue)) : null,
      newValue: newValue ? JSON.parse(JSON.stringify(newValue)) : null,
      metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : null,
    });
  }

  /**
   * Extrait la liste chronologique de toutes les actions enregistrées pour un ticket.
   *
   * @param ticketId UUID du ticket.
   */
  async getHistory(ticketId: string) {
    return this.drizzle.db
      .select()
      .from(ticketHistory)
      .where(eq(ticketHistory.ticketId, ticketId))
      .orderBy(ticketHistory.createdAt);
  }
}
