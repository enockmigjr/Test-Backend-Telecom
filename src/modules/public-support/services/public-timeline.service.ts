import { Injectable } from '@nestjs/common';
import { and, eq, inArray } from 'drizzle-orm';
import { DrizzleProvider } from '../../../database/drizzle.provider';
import { externalRequesters, ticketComments, ticketHistory, tickets, users } from '../../../database/schemas';
import { PublicPrincipal } from '../../external-identity/interfaces/public-principal.interface';
import { PublicStatusMapperService } from './public-status-mapper.service';
import { PublicTicketAccessService } from './public-ticket-access.service';
import { isRecord } from '../../../common/utils/helpers';

@Injectable()
export class PublicTimelineService {
  constructor(
    private readonly drizzle: DrizzleProvider,
    private readonly access: PublicTicketAccessService,
    private readonly statuses: PublicStatusMapperService,
  ) {}

  async get(ticketId: string, principal: PublicPrincipal) {
    await this.access.requireTicket(ticketId, principal);
    const [comments, history] = await Promise.all([
      this.drizzle.db
        .select({
          id: ticketComments.id,
          content: ticketComments.content,
          actorType: ticketComments.actorType,
          correctsCommentId: ticketComments.correctsCommentId,
          createdAt: ticketComments.createdAt,
          internalFirstName: users.firstName,
          requesterName: externalRequesters.displayName,
        })
        .from(ticketComments)
        .leftJoin(users, eq(ticketComments.authorId, users.id))
        .leftJoin(
          externalRequesters,
          and(
            eq(ticketComments.externalRequesterId, externalRequesters.id),
            eq(ticketComments.supportIntegrationId, externalRequesters.supportIntegrationId),
          ),
        )
        .where(
          and(
            eq(ticketComments.ticketId, ticketId),
            eq(ticketComments.supportIntegrationId, principal.supportIntegrationId),
          ),
        ),
      this.drizzle.db
        .select({
          id: ticketHistory.id,
          action: ticketHistory.action,
          newValue: ticketHistory.newValue,
          createdAt: ticketHistory.createdAt,
        })
        .from(ticketHistory)
        .where(
          and(
            eq(ticketHistory.ticketId, ticketId),
            eq(ticketHistory.supportIntegrationId, principal.supportIntegrationId),
            inArray(ticketHistory.action, ['TICKET_CREATED', 'STATUS_CHANGED']),
          ),
        ),
    ]);
    const entries = [
      ...comments.map((comment) => ({
        id: comment.id,
        type: 'COMMENT' as const,
        content: comment.content,
        correctsCommentId: comment.correctsCommentId,
        author:
          comment.actorType === 'INTERNAL'
            ? (comment.internalFirstName ?? 'Équipe support')
            : (comment.requesterName ?? 'Vous'),
        createdAt: comment.createdAt,
      })),
      ...history.map((entry) => ({
        id: entry.id,
        type: 'STATUS' as const,
        status: entry.action === 'TICKET_CREATED' ? 'RECEIVED' : this.publicStatus(entry.newValue),
        createdAt: entry.createdAt,
      })),
    ].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    return { data: entries };
  }

  private publicStatus(value: unknown) {
    if (!isRecord(value) || !isTicketStatus(value['status'])) return undefined;
    return this.statuses.map(value['status']);
  }
}

function isTicketStatus(value: unknown): value is typeof tickets.$inferSelect.status {
  return (
    typeof value === 'string' &&
    [
      'NEW',
      'ASSIGNED',
      'IN_PROGRESS',
      'PENDING_CUSTOMER',
      'PENDING_THIRD_PARTY',
      'RESOLVED',
      'CLOSED',
      'REOPENED',
      'CANCELLED',
    ].includes(value)
  );
}
