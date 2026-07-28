import { Injectable } from '@nestjs/common';
import { count, eq, sql } from 'drizzle-orm';
import { normalizePagination } from '../../../common/helpers/normalized-pagination.helper';
import { PaginationHelper } from '../../../common/helpers/pagination.helper';
import { DrizzleProvider } from '../../../database/drizzle.provider';
import { ticketAssignments, ticketComments } from '../../../database/schemas';
import { TicketsService } from './tickets.service';

@Injectable()
export class TicketDetailsService {
  constructor(
    private readonly drizzle: DrizzleProvider,
    private readonly ticketsService: TicketsService,
  ) {}

  async findById(id: string, page = 1, limit = 20) {
    const { data: ticket } = await this.ticketsService.findById(id);
    const pagination = normalizePagination(page, limit);
    const [[commentCount], [assignmentTotal], assignments] = await Promise.all([
      this.drizzle.db.select({ count: count() }).from(ticketComments).where(eq(ticketComments.ticketId, id)),
      this.drizzle.db.select({ count: count() }).from(ticketAssignments).where(eq(ticketAssignments.ticketId, id)),
      this.drizzle.db
        .select({
          id: ticketAssignments.id,
          toUserId: ticketAssignments.toUserId,
          fromUserId: ticketAssignments.fromUserId,
          reason: ticketAssignments.reason,
          createdAt: ticketAssignments.createdAt,
        })
        .from(ticketAssignments)
        .where(eq(ticketAssignments.ticketId, id))
        .orderBy(sql`${ticketAssignments.createdAt} asc`)
        .limit(pagination.limit)
        .offset(PaginationHelper.getOffset(pagination.page, pagination.limit)),
    ]);
    const totalAssignments = Number(assignmentTotal?.count ?? 0);

    return {
      data: {
        ...ticket,
        _meta: {
          commentCount: Number(commentCount?.count ?? 0),
          assignmentCount: totalAssignments,
        },
        assignmentHistory: PaginationHelper.paginate(assignments, totalAssignments, pagination.page, pagination.limit),
      },
    };
  }
}
