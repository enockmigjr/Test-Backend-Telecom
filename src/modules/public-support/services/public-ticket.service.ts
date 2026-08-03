import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { normalizePagination } from '../../../common/helpers/normalized-pagination.helper';
import { PaginationHelper } from '../../../common/helpers/pagination.helper';
import { generateUuid } from '../../../common/helpers/uuidv7.helper';
import { DrizzleProvider } from '../../../database/drizzle.provider';
import {
  outboxEvents,
  supportConversations,
  supportMessages,
  ticketComments,
  ticketHistory,
  tickets,
} from '../../../database/schemas';
import { PublicPrincipal } from '../../external-identity/interfaces/public-principal.interface';
import { PublicStatusMapperService } from './public-status-mapper.service';
import { PublicTicketAccessService } from './public-ticket-access.service';
import { PublicTimelineService } from './public-timeline.service';

@Injectable()
export class PublicTicketService {
  constructor(
    private readonly drizzle: DrizzleProvider,
    private readonly access: PublicTicketAccessService,
    private readonly statuses: PublicStatusMapperService,
    private readonly publicTimeline: PublicTimelineService,
  ) {}

  async list(principal: PublicPrincipal, pageInput?: string, limitInput?: string) {
    const page = normalizePagination(pageInput, limitInput);
    const where = and(
      eq(tickets.requesterId, principal.externalRequesterId),
      eq(tickets.supportIntegrationId, principal.supportIntegrationId),
      isNull(tickets.deletedAt),
    );
    const [count, rows] = await Promise.all([
      this.drizzle.db
        .select({ count: sql<number>`count(*)` })
        .from(tickets)
        .where(where),
      this.drizzle.db
        .select({
          id: tickets.id,
          ticketNumber: tickets.ticketNumber,
          title: tickets.title,
          status: tickets.status,
          createdAt: tickets.createdAt,
          updatedAt: tickets.updatedAt,
        })
        .from(tickets)
        .where(where)
        .orderBy(desc(tickets.createdAt))
        .limit(page.limit)
        .offset(PaginationHelper.getOffset(page.page, page.limit)),
    ]);
    return PaginationHelper.paginate(
      rows.map((item) => ({ ...item, status: this.statuses.map(item.status) })),
      Number(count[0]?.count ?? 0),
      page.page,
      page.limit,
    );
  }

  async detail(ticketId: string, principal: PublicPrincipal) {
    const ticket = await this.access.requireTicket(ticketId, principal);
    return {
      data: {
        id: ticket.id,
        ticketNumber: ticket.ticketNumber,
        title: ticket.title,
        description: ticket.description,
        status: this.statuses.map(ticket.status),
        firstResponseDueAt: ticket.firstResponseDueAt,
        resolutionDueAt: ticket.resolutionDueAt,
        resolvedAt: ticket.resolvedAt,
        closedAt: ticket.closedAt,
        createdAt: ticket.createdAt,
        updatedAt: ticket.updatedAt,
      },
    };
  }

  timeline(ticketId: string, principal: PublicPrincipal) {
    return this.publicTimeline.get(ticketId, principal);
  }

  async addComment(ticketId: string, principal: PublicPrincipal, contentInput: string) {
    return this.drizzle.runInTransaction(async () => {
      await this.access.requireTicket(ticketId, principal);
      const [conversation] = await this.drizzle.db
        .select({ id: supportConversations.id })
        .from(supportConversations)
        .where(
          and(
            eq(supportConversations.ticketId, ticketId),
            eq(supportConversations.externalRequesterId, principal.externalRequesterId),
            eq(supportConversations.supportIntegrationId, principal.supportIntegrationId),
          ),
        )
        .limit(1);
      if (!conversation) throw new ServiceUnavailableException('Conversation de suivi indisponible.');
      const commentId = generateUuid();
      const mutationId = generateUuid();
      const content = contentInput.trim();
      await this.drizzle.db.insert(ticketComments).values({
        id: commentId,
        ticketId,
        actorType: 'EXTERNAL_REQUESTER',
        externalRequesterId: principal.externalRequesterId,
        supportIntegrationId: principal.supportIntegrationId,
        content,
      });
      await this.drizzle.db.insert(supportMessages).values({
        id: generateUuid(),
        supportIntegrationId: principal.supportIntegrationId,
        conversationId: conversation.id,
        ticketCommentId: commentId,
        actorType: 'EXTERNAL_REQUESTER',
        externalRequesterId: principal.externalRequesterId,
        direction: 'INBOUND',
        channelMetadata: {},
      });
      await this.drizzle.db.insert(ticketHistory).values({
        id: generateUuid(),
        ticketId,
        actorType: 'EXTERNAL_REQUESTER',
        externalRequesterId: principal.externalRequesterId,
        supportIntegrationId: principal.supportIntegrationId,
        action: 'PUBLIC_REQUESTER_COMMENT_CREATED',
        newValue: { commentId },
      });
      await this.drizzle.db.insert(outboxEvents).values({
        id: generateUuid(),
        mutationId,
        schemaVersion: 1,
        supportIntegrationId: principal.supportIntegrationId,
        actorType: 'EXTERNAL_REQUESTER',
        externalRequesterId: principal.externalRequesterId,
        aggregateType: 'TICKET',
        aggregateId: ticketId,
        eventType: 'PUBLIC_REQUESTER_COMMENT_CREATED',
        deduplicationKey: `public-requester-comment:${mutationId}`,
        payload: { ticketId, commentId, conversationId: conversation.id },
      });
      await this.drizzle.db
        .update(supportConversations)
        .set({ lastMessageAt: new Date(), currentState: 'FOLLOW_UP_OR_HANDOFF' })
        .where(eq(supportConversations.id, conversation.id));
      return { data: { id: commentId, content } };
    });
  }
}
