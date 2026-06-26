import { Injectable } from '@nestjs/common';
import { and, or, eq, gte, lte, like, isNull, sql, SQL } from 'drizzle-orm';
import { DrizzleProvider } from '../../../database/drizzle.provider';
import { tickets } from '../../../database/schemas';
import { PaginationHelper } from '../../../common/helpers/pagination.helper';

export interface TicketSearchFilters {
  status?: string;
  priority?: string;
  severity?: string;
  category?: string;
  assignedTo?: string;
  assignedTeam?: string;
  departmentId?: string;
  createdBy?: string;
  search?: string;
  from?: string;
  to?: string;
  tags?: string[];
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

@Injectable()
export class TicketsSearchService {
  constructor(private readonly drizzle: DrizzleProvider) {}

  async search(filters: TicketSearchFilters) {
    const { page = 1, limit = 20, sort = 'createdAt', order = 'desc' } = filters;
    const offset = PaginationHelper.getOffset(page, limit);

    const conditions = [isNull(tickets.deletedAt)];

    if (filters.status) {
      conditions.push(eq(tickets.status, filters.status as typeof tickets.$inferSelect.status));
    }
    if (filters.priority) {
      conditions.push(eq(tickets.priority, filters.priority as typeof tickets.$inferSelect.priority));
    }
    if (filters.severity) {
      conditions.push(eq(tickets.severity, filters.severity as typeof tickets.$inferSelect.severity));
    }
    if (filters.category) {
      conditions.push(eq(tickets.category, filters.category as typeof tickets.$inferSelect.category));
    }
    if (filters.assignedTo) {
      conditions.push(eq(tickets.assignedTo, filters.assignedTo));
    }
    if (filters.assignedTeam) {
      conditions.push(eq(tickets.assignedTeamId, filters.assignedTeam));
    }
    if (filters.departmentId) {
      conditions.push(eq(tickets.departmentId, filters.departmentId));
    }
    if (filters.createdBy) {
      conditions.push(eq(tickets.createdBy, filters.createdBy));
    }
    if (filters.from) {
      conditions.push(gte(tickets.createdAt, new Date(filters.from)));
    }
    if (filters.to) {
      conditions.push(lte(tickets.createdAt, new Date(filters.to)));
    }
    if (filters.search) {
      const searchTerm = `%${filters.search}%`;
      conditions.push(
        or(
          like(tickets.title, searchTerm),
          like(tickets.description, searchTerm),
          like(tickets.ticketNumber, searchTerm),
        ) as SQL<unknown>,
      );
    }

    const where = and(...conditions);

    const [total] = await this.drizzle.db
      .select({ count: sql<number>`count(*)` })
      .from(tickets)
      .where(where);

    const data = await this.drizzle.db
      .select({
        id: tickets.id,
        ticketNumber: tickets.ticketNumber,
        title: tickets.title,
        status: tickets.status,
        priority: tickets.priority,
        severity: tickets.severity,
        category: tickets.category,
        assignedTo: tickets.assignedTo,
        customerName: tickets.customerName,
        createdAt: tickets.createdAt,
        updatedAt: tickets.updatedAt,
      })
      .from(tickets)
      .where(where)
      .orderBy(order === 'asc' ? tickets.createdAt : sql`${tickets.createdAt} desc`)
      .limit(limit)
      .offset(offset);

    return PaginationHelper.paginate(data, total?.count || 0, page, limit);
  }
}
