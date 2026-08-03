import { Injectable, NotFoundException } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import { DrizzleProvider } from '../../../database/drizzle.provider';
import { supportConversations, tickets } from '../../../database/schemas';
import { PublicPrincipal } from '../../external-identity/interfaces/public-principal.interface';

@Injectable()
export class PublicTicketAccessService {
  constructor(private readonly drizzle: DrizzleProvider) {}

  async requireTicket(ticketId: string, principal: PublicPrincipal) {
    const [ticket] = await this.drizzle.db
      .select()
      .from(tickets)
      .where(
        and(
          eq(tickets.id, ticketId),
          eq(tickets.requesterId, principal.externalRequesterId),
          eq(tickets.supportIntegrationId, principal.supportIntegrationId),
          isNull(tickets.deletedAt),
        ),
      )
      .limit(1);
    if (!ticket) throw new NotFoundException('Demande introuvable.');
    return ticket;
  }

  async requireConversation(conversationId: string, principal: PublicPrincipal) {
    const [conversation] = await this.drizzle.db
      .select()
      .from(supportConversations)
      .where(
        and(
          eq(supportConversations.id, conversationId),
          eq(supportConversations.externalRequesterId, principal.externalRequesterId),
          eq(supportConversations.supportIntegrationId, principal.supportIntegrationId),
        ),
      )
      .limit(1);
    if (!conversation) throw new NotFoundException('Conversation introuvable.');
    return conversation;
  }
}
