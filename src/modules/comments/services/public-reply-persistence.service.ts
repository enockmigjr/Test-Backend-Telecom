import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import { generateUuid } from '../../../common/helpers/uuidv7.helper';
import { DrizzleProvider } from '../../../database/drizzle.provider';
import {
  outboxEvents,
  supportConversations,
  supportMessages,
  ticketComments,
  tickets,
} from '../../../database/schemas';
import { TicketActor } from '../../tickets/domain/ticket-actor';
import { TicketHistoryService } from '../../tickets/services/ticket-history.service';

@Injectable()
export class PublicReplyPersistenceService {
  constructor(
    private readonly drizzle: DrizzleProvider,
    private readonly ticketHistory: TicketHistoryService,
  ) {}

  async assertCorrectionTarget(ticketId: string, integrationId: string | undefined, commentId: string) {
    const [target] = await this.drizzle.db
      .select({ id: ticketComments.id })
      .from(ticketComments)
      .where(
        and(
          eq(ticketComments.id, commentId),
          eq(ticketComments.ticketId, ticketId),
          eq(ticketComments.actorType, 'INTERNAL'),
          integrationId
            ? eq(ticketComments.supportIntegrationId, integrationId)
            : isNull(ticketComments.supportIntegrationId),
        ),
      )
      .limit(1);
    if (!target) throw new NotFoundException('Réponse à corriger introuvable.');
  }

  async persist(
    ticketId: string,
    commentId: string,
    actor: Extract<TicketActor, { type: 'INTERNAL' }>,
    integrationId: string,
    correctsCommentId?: string,
  ): Promise<void> {
    const [conversation] = await this.drizzle.db
      .select({ id: supportConversations.id })
      .from(supportConversations)
      .where(
        and(eq(supportConversations.ticketId, ticketId), eq(supportConversations.supportIntegrationId, integrationId)),
      )
      .limit(1);
    if (!conversation) throw new ConflictException('Conversation publique associée introuvable.');
    await this.drizzle.db.insert(supportMessages).values({
      id: generateUuid(),
      supportIntegrationId: integrationId,
      conversationId: conversation.id,
      ticketCommentId: commentId,
      actorType: 'INTERNAL',
      userId: actor.userId,
      direction: 'OUTBOUND',
      channelMetadata: {},
    });
    await this.drizzle.db
      .update(tickets)
      .set({ firstResponseAt: new Date() })
      .where(and(eq(tickets.id, ticketId), isNull(tickets.firstResponseAt)));
    const action = correctsCommentId ? 'PUBLIC_REPLY_CORRECTED' : 'PUBLIC_REPLY_CREATED';
    await this.ticketHistory.recordByActor(
      ticketId,
      actor,
      action,
      null,
      { commentId, correctsCommentId },
      undefined,
      integrationId,
    );
    const mutationId = generateUuid();
    await this.drizzle.db.insert(outboxEvents).values({
      id: generateUuid(),
      mutationId,
      schemaVersion: 1,
      supportIntegrationId: integrationId,
      actorType: 'INTERNAL',
      userId: actor.userId,
      aggregateType: 'TICKET',
      aggregateId: ticketId,
      eventType: action,
      deduplicationKey: `${action.toLowerCase()}:${mutationId}`,
      payload: {
        ticketId,
        commentId,
        conversationId: conversation.id,
        ...(correctsCommentId ? { correctsCommentId } : {}),
      },
    });
    await this.drizzle.db
      .update(supportConversations)
      .set({ lastMessageAt: new Date(), currentState: 'FOLLOW_UP_OR_HANDOFF' })
      .where(eq(supportConversations.id, conversation.id));
  }
}
