import { Injectable, NotFoundException } from '@nestjs/common';
import { and, count, eq, gte, isNull, lte, sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { ticketVisibilityCondition } from '../../common/services/ticket-access.service';
import { DrizzleProvider } from '../../database/drizzle.provider';
import { categories, departments, Report, reports, tickets } from '../../database/schemas';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

@Injectable()
export class ReportQueryService {
  constructor(private readonly drizzle: DrizzleProvider) {}

  async ticketReport(ticketId: string, user?: JwtPayload) {
    const visibility = user ? ticketVisibilityCondition(user) : undefined;
    const [ticket] = await this.drizzle.db
      .select({
        id: tickets.id,
        ticketNumber: tickets.ticketNumber,
        title: tickets.title,
        description: tickets.description,
        status: tickets.status,
        priority: tickets.priority,
        severity: tickets.severity,
        category: categories.name,
        createdAt: tickets.createdAt,
        resolvedAt: tickets.resolvedAt,
        closedAt: tickets.closedAt,
        customerName: tickets.customerName,
        resolutionSummary: tickets.resolutionSummary,
        departmentName: departments.name,
      })
      .from(tickets)
      .leftJoin(departments, eq(tickets.departmentId, departments.id))
      .leftJoin(categories, eq(tickets.categoryId, categories.id))
      .where(and(eq(tickets.id, ticketId), isNull(tickets.deletedAt), visibility))
      .limit(1);
    if (!ticket) throw new NotFoundException(`Ticket introuvable pour l'id ${ticketId}.`);
    return { generatedAt: new Date().toISOString(), type: 'ticket-report', ticket };
  }

  async slaReport(from?: string, to?: string, departmentId?: string) {
    const fromDate = from ? new Date(from) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const toDate = to ? new Date(to) : new Date();
    const where = and(
      gte(tickets.createdAt, fromDate),
      lte(tickets.createdAt, toDate),
      isNull(tickets.deletedAt),
      departmentId ? eq(tickets.assignedTeamId, departmentId) : undefined,
    );
    const [[stats], byPriority] = await Promise.all([
      this.drizzle.db
        .select({
          total: count(),
          breached: sql<number>`COUNT(*) FILTER (WHERE ${tickets.slaBreached} = true)`,
          avgResolutionMinutes: sql<number>`COALESCE(AVG(EXTRACT(EPOCH FROM (${tickets.resolvedAt} - ${tickets.createdAt})) / 60) FILTER (WHERE ${tickets.resolvedAt} IS NOT NULL), 0)`,
        })
        .from(tickets)
        .where(where),
      this.drizzle.db
        .select({
          priority: tickets.priority,
          count: count(),
          breached: sql<number>`COUNT(*) FILTER (WHERE ${tickets.slaBreached} = true)`,
        })
        .from(tickets)
        .where(where)
        .groupBy(tickets.priority),
    ]);
    return {
      generatedAt: new Date().toISOString(),
      type: 'sla-report',
      period: { from: fromDate.toISOString(), to: toDate.toISOString() },
      summary: {
        total: Number(stats?.total || 0),
        breached: Number(stats?.breached || 0),
        avgResolutionMinutes: Math.round(Number(stats?.avgResolutionMinutes || 0)),
      },
      byPriority,
    };
  }

  async getReport(id: string): Promise<Report> {
    const [report] = await this.drizzle.db.select().from(reports).where(eq(reports.id, id)).limit(1);
    if (!report) throw new NotFoundException('Rapport introuvable.');
    return report;
  }

  async listReports(page = 1, limit = 20, requestedBy?: string) {
    const where: SQL | undefined = requestedBy ? eq(reports.requestedBy, requestedBy) : undefined;
    const [totalResult, data] = await Promise.all([
      this.drizzle.db.select({ count: count() }).from(reports).where(where),
      this.drizzle.db
        .select()
        .from(reports)
        .where(where)
        .orderBy(sql`${reports.createdAt} DESC`)
        .limit(limit)
        .offset((page - 1) * limit),
    ]);
    const total = Number(totalResult[0]?.count ?? 0);
    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }
}
