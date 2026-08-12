/**
 * À la clôture d'un ticket public, génère un lien de satisfaction et le confie
 * au pipeline outbox/external-delivery pour envoi email au demandeur.
 */
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { and, eq } from 'drizzle-orm';
import { generateUuid } from '../../common/helpers/uuidv7.helper';
import { DrizzleProvider } from '../../database/drizzle.provider';
import { outboxEvents, supportConversations } from '../../database/schemas';
import { TicketClosedEvent } from '../tickets/domain/ticket.events';
import { SupportSatisfactionService } from './support-satisfaction.service';

@Injectable()
export class TicketSatisfactionListener {
  private readonly logger = new Logger(TicketSatisfactionListener.name);

  constructor(
    private readonly drizzle: DrizzleProvider,
    private readonly service: SupportSatisfactionService,
  ) {}

  @OnEvent('ticket.closed')
  async handleClosed(event: TicketClosedEvent): Promise<void> {
    if (!event.supportIntegrationId) return;
    const [conversation] = await this.drizzle.db
      .select({ id: supportConversations.id })
      .from(supportConversations)
      .where(
        and(
          eq(supportConversations.ticketId, event.ticketId),
          eq(supportConversations.supportIntegrationId, event.supportIntegrationId),
        ),
      )
      .limit(1);
    if (!conversation) return;

    let url: string;
    try {
      url = (await this.service.createForTicket(event.ticketId)).url;
    } catch {
      return; // jeton déjà actif pour ce ticket
    }

    const mutationId = generateUuid();
    await this.drizzle.db.insert(outboxEvents).values({
      id: generateUuid(),
      mutationId,
      schemaVersion: 1,
      supportIntegrationId: event.supportIntegrationId,
      actorType: 'SYSTEM',
      userId: null,
      aggregateType: 'TICKET',
      aggregateId: event.ticketId,
      eventType: 'SATISFACTION_REQUEST',
      deduplicationKey: `satisfaction_request:${event.ticketId}`,
      payload: { ticketId: event.ticketId, conversationId: conversation.id, satisfactionUrl: url },
    });
    this.logger.log(`Lien de satisfaction généré pour le ticket ${event.ticketId}.`);
  }
}
