import { Injectable } from '@nestjs/common';
import { and, asc, desc, eq, gte, ilike, isNull, lte, or, sql, SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { normalizePagination } from '../../../common/helpers/normalized-pagination.helper';
import { PaginationHelper } from '../../../common/helpers/pagination.helper';
import { ticketVisibilityCondition } from '../../../common/services/ticket-access.service';
import { DrizzleProvider } from '../../../database/drizzle.provider';
import { categories, departments, tickets, users } from '../../../database/schemas';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';

export interface TicketSearchFilters {
  status?: string;
  priority?: string;
  severity?: string;
  categoryId?: string;
  assignedTo?: string;
  assignedTeam?: string;
  departmentId?: string;
  createdBy?: string;
  search?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
  sort?: 'createdAt' | 'updatedAt' | 'priority' | 'severity' | 'status' | 'ticketNumber';
  order?: 'asc' | 'desc';
}

const assignedTeam = alias(departments, 'search_assigned_team');
const assignee = alias(users, 'search_assignee');

@Injectable()
export class TicketsSearchService {
  constructor(private readonly drizzle: DrizzleProvider) {}

  async search(filters: TicketSearchFilters, user: JwtPayload) {
    const pagination = normalizePagination(filters.page, filters.limit);
    const conditions: SQL<unknown>[] = [isNull(tickets.deletedAt)];
    const visibility = ticketVisibilityCondition(user);
    if (visibility) conditions.push(visibility);
    this.addFilters(conditions, filters);
    const where = and(...conditions);
    const [total] = await this.drizzle.db
      .select({ count: sql<number>`count(*)` })
      .from(tickets)
      .where(where);

    const sortColumns = {
      createdAt: tickets.createdAt,
      updatedAt: tickets.updatedAt,
      priority: tickets.priority,
      severity: tickets.severity,
      status: tickets.status,
      ticketNumber: tickets.ticketNumber,
    } as const;
    const sortColumn = sortColumns[filters.sort ?? 'createdAt'];
    const data = await this.drizzle.db
      .select({
        id: tickets.id,
        ticketNumber: tickets.ticketNumber,
        title: tickets.title,
        status: tickets.status,
        priority: tickets.priority,
        severity: tickets.severity,
        categoryId: tickets.categoryId,
        categoryName: categories.name,
        assignedTo: tickets.assignedTo,
        assigneeName: sql<string>`concat(${assignee.firstName}, ' ', ${assignee.lastName})`,
        departmentName: departments.name,
        assignedTeamName: assignedTeam.name,
        customerName: tickets.customerName,
        resolutionDueAt: tickets.resolutionDueAt,
        slaBreached: tickets.slaBreached,
        createdAt: tickets.createdAt,
        updatedAt: tickets.updatedAt,
      })
      .from(tickets)
      .leftJoin(categories, eq(tickets.categoryId, categories.id))
      .leftJoin(departments, eq(tickets.departmentId, departments.id))
      .leftJoin(assignedTeam, eq(tickets.assignedTeamId, assignedTeam.id))
      .leftJoin(assignee, eq(tickets.assignedTo, assignee.id))
      .where(where)
      .orderBy(filters.order === 'asc' ? asc(sortColumn) : desc(sortColumn))
      .limit(pagination.limit)
      .offset(PaginationHelper.getOffset(pagination.page, pagination.limit));
    return PaginationHelper.paginate(data, Number(total?.count ?? 0), pagination.page, pagination.limit);
  }

  private addFilters(conditions: SQL<unknown>[], filters: TicketSearchFilters): void {
    if (filters.status) conditions.push(eq(tickets.status, filters.status as typeof tickets.$inferSelect.status));
    if (filters.priority) {
      conditions.push(eq(tickets.priority, filters.priority as typeof tickets.$inferSelect.priority));
    }
    if (filters.severity) {
      conditions.push(eq(tickets.severity, filters.severity as typeof tickets.$inferSelect.severity));
    }
    if (filters.categoryId) conditions.push(eq(tickets.categoryId, filters.categoryId));
    if (filters.assignedTo) conditions.push(eq(tickets.assignedTo, filters.assignedTo));
    if (filters.assignedTeam) conditions.push(eq(tickets.assignedTeamId, filters.assignedTeam));
    if (filters.departmentId) conditions.push(eq(tickets.departmentId, filters.departmentId));
    if (filters.createdBy) conditions.push(eq(tickets.createdBy, filters.createdBy));
    if (filters.from) conditions.push(gte(tickets.createdAt, new Date(filters.from)));
    if (filters.to) conditions.push(lte(tickets.createdAt, new Date(filters.to)));
    if (filters.search) {
      const term = `%${filters.search}%`;
      conditions.push(
        or(
          ilike(tickets.title, term),
          ilike(tickets.description, term),
          ilike(tickets.ticketNumber, term),
          ilike(tickets.customerName, term),
          ilike(tickets.customerAccountNumber, term),
          ilike(tickets.customerContact, term),
        ) as SQL<unknown>,
      );
    }
  }
}
