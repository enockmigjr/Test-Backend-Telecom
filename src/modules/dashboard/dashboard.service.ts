import { Injectable } from '@nestjs/common';
import { and, gte, lte, eq, sql, isNull } from 'drizzle-orm';
import { DrizzleProvider } from '../../database/drizzle.provider';
import { tickets, departments } from '../../database/schemas';

@Injectable()
export class DashboardService {
  constructor(private readonly drizzle: DrizzleProvider) {}

  async overview(from?: string, to?: string) {
    const fromDate = from ? new Date(from) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const toDate = to ? new Date(to) : new Date();
    const where = and(gte(tickets.createdAt, fromDate), lte(tickets.createdAt, toDate), isNull(tickets.deletedAt));

    const [totals] = await this.drizzle.db
      .select({ total: sql<number>`count(*)` })
      .from(tickets)
      .where(where);

    const [openTickets] = await this.drizzle.db
      .select({ count: sql<number>`count(*)` })
      .from(tickets)
      .where(and(where, sql`${tickets.status} NOT IN ('RESOLVED','CLOSED','CANCELLED')`));

    const [criticalTickets] = await this.drizzle.db
      .select({ count: sql<number>`count(*)` })
      .from(tickets)
      .where(
        and(
          where,
          eq(tickets.priority, 'CRITICAL' as const),
          sql`${tickets.status} NOT IN ('RESOLVED','CLOSED','CANCELLED')`,
        ),
      );

    // Tickets par statut
    const byStatus = await this.drizzle.db
      .select({ status: tickets.status, count: sql<number>`count(*)` })
      .from(tickets)
      .where(where)
      .groupBy(tickets.status);

    // Tickets par priorité
    const byPriority = await this.drizzle.db
      .select({ priority: tickets.priority, count: sql<number>`count(*)` })
      .from(tickets)
      .where(where)
      .groupBy(tickets.priority);

    return {
      period: { from: fromDate.toISOString(), to: toDate.toISOString() },
      ticketVolume: {
        total: totals?.total || 0,
        openTickets: openTickets?.count || 0,
        criticalNow: criticalTickets?.count || 0,
      },
      byStatus: Object.fromEntries(byStatus.map((s) => [s.status, Number(s.count)])),
      byPriority: Object.fromEntries(byPriority.map((p) => [p.priority, Number(p.count)])),
    };
  }

  async departments_report(from?: string, to?: string) {
    const fromDate = from ? new Date(from) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const toDate = to ? new Date(to) : new Date();
    const where = and(gte(tickets.createdAt, fromDate), lte(tickets.createdAt, toDate), isNull(tickets.deletedAt));

    const data = await this.drizzle.db
      .select({
        departmentId: tickets.departmentId,
        departmentName: departments.name,
        total: sql<number>`count(*)`,
        open: sql<number>`count(*) FILTER (WHERE ${tickets.status} NOT IN ('RESOLVED','CLOSED','CANCELLED'))`,
        resolved: sql<number>`count(*) FILTER (WHERE ${tickets.status} = 'RESOLVED')`,
        closed: sql<number>`count(*) FILTER (WHERE ${tickets.status} = 'CLOSED')`,
      })
      .from(tickets)
      .leftJoin(departments, eq(tickets.departmentId, departments.id))
      .where(where)
      .groupBy(tickets.departmentId, departments.name);

    return { period: { from: fromDate.toISOString(), to: toDate.toISOString() }, data };
  }

  async workload() {
    const data = await this.drizzle.db
      .select({
        assignedTo: tickets.assignedTo,
        total: sql<number>`count(*)`,
        critical: sql<number>`count(*) FILTER (WHERE ${tickets.priority} = 'CRITICAL')`,
        high: sql<number>`count(*) FILTER (WHERE ${tickets.priority} = 'HIGH')`,
      })
      .from(tickets)
      .where(
        and(
          isNull(tickets.deletedAt),
          sql`${tickets.status} NOT IN ('RESOLVED','CLOSED','CANCELLED')`,
          sql`${tickets.assignedTo} IS NOT NULL`,
        ),
      )
      .groupBy(tickets.assignedTo);

    const unassigned = await this.drizzle.db
      .select({ count: sql<number>`count(*)` })
      .from(tickets)
      .where(
        and(
          isNull(tickets.deletedAt),
          sql`${tickets.status} NOT IN ('RESOLVED','CLOSED','CANCELLED')`,
          sql`${tickets.assignedTo} IS NULL`,
        ),
      );

    return {
      generatedAt: new Date().toISOString(),
      data,
      summary: {
        totalAgents: data.length,
        totalOpenTickets: data.reduce((sum, a) => sum + Number(a.total), 0),
        unassignedTickets: Number(unassigned[0]?.count || 0),
      },
    };
  }
}
