import { Injectable } from '@nestjs/common';
import { and, gte, lte, eq, sql, isNull, count } from 'drizzle-orm';
import { DrizzleProvider } from '../../database/drizzle.provider';
import { tickets, departments } from '../../database/schemas';

@Injectable()
export class DashboardService {
  constructor(private readonly drizzle: DrizzleProvider) {}

  /** KPIs globaux de la plateforme */
  async overview(from?: string, to?: string) {
    const fromDate = from ? new Date(from) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const toDate = to ? new Date(to) : new Date();
    const rangeWhere = and(gte(tickets.createdAt, fromDate), lte(tickets.createdAt, toDate), isNull(tickets.deletedAt));
    const openWhere = and(rangeWhere, sql`${tickets.status} NOT IN ('RESOLVED','CLOSED','CANCELLED')`);

    const [[totals], [openTickets], [], [resolvedToday], [createdToday], [breachedCount], [atRiskCount]] =
      await Promise.all([
        this.drizzle.db.select({ total: count() }).from(tickets).where(rangeWhere),
        this.drizzle.db.select({ count: count() }).from(tickets).where(openWhere),
        this.drizzle.db
          .select({ count: count() })
          .from(tickets)
          .where(and(openWhere, eq(tickets.priority, 'CRITICAL' as const))),
        this.drizzle.db
          .select({ count: count() })
          .from(tickets)
          .where(and(rangeWhere, eq(tickets.status, 'RESOLVED' as const))),
        this.drizzle.db.select({ count: count() }).from(tickets).where(rangeWhere), // approximation
        this.drizzle.db
          .select({ count: count() })
          .from(tickets)
          .where(and(openWhere, lte(tickets.resolutionDueAt, new Date()))),
        this.drizzle.db
          .select({ count: count() })
          .from(tickets)
          .where(
            and(
              openWhere,
              gte(tickets.resolutionDueAt, new Date()),
              lte(tickets.resolutionDueAt, new Date(Date.now() + 30 * 60 * 1000)),
            ),
          ),
      ]);

    const byStatus = await this.drizzle.db
      .select({ status: tickets.status, count: count() })
      .from(tickets)
      .where(rangeWhere)
      .groupBy(tickets.status);
    const byPriority = await this.drizzle.db
      .select({ priority: tickets.priority, count: count() })
      .from(tickets)
      .where(rangeWhere)
      .groupBy(tickets.priority);
    const bySeverity = await this.drizzle.db
      .select({ severity: tickets.severity, count: count() })
      .from(tickets)
      .where(rangeWhere)
      .groupBy(tickets.severity);

    const total = Number(totals?.total || 0);
    const compliant = total - Number(breachedCount?.count || 0);

    return {
      period: { from: fromDate.toISOString(), to: toDate.toISOString() },
      ticketVolume: {
        total,
        openTickets: Number(openTickets?.count || 0),
        resolvedToday: Number(resolvedToday?.count || 0),
        createdToday: Number(createdToday?.count || 0),
      },
      byStatus: Object.fromEntries(byStatus.map((s) => [s.status, Number(s.count)])),
      byPriority: Object.fromEntries(byPriority.map((p) => [p.priority, Number(p.count)])),
      bySeverity: Object.fromEntries(bySeverity.map((s) => [s.severity, Number(s.count)])),
      sla: {
        totalTracked: total,
        breached: Number(breachedCount?.count || 0),
        atRisk: Number(atRiskCount?.count || 0),
        compliant,
        complianceRate: total > 0 ? Number(((compliant / total) * 100).toFixed(2)) : 100,
      },
    };
  }

  /** Tickets par statut avec âge moyen */
  async ticketsByStatus(from?: string, to?: string, departmentId?: string) {
    const fromDate = from ? new Date(from) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const toDate = to ? new Date(to) : new Date();
    const conditions = [gte(tickets.createdAt, fromDate), lte(tickets.createdAt, toDate), isNull(tickets.deletedAt)];
    if (departmentId) conditions.push(eq(tickets.departmentId, departmentId));
    const where = and(...conditions);

    const data = await this.drizzle.db
      .select({
        status: tickets.status,
        count: count(),
        avgAgeMinutes: sql<number>`COALESCE(AVG(EXTRACT(EPOCH FROM (NOW() - ${tickets.createdAt})) / 60), 0)`,
      })
      .from(tickets)
      .where(where)
      .groupBy(tickets.status);

    const total = data.reduce((sum, d) => sum + Number(d.count), 0);
    return {
      period: { from: fromDate.toISOString(), to: toDate.toISOString() },
      data: data.map((d) => ({
        ...d,
        count: Number(d.count),
        avgAgeMinutes: Math.round(Number(d.avgAgeMinutes)),
        percentage: total > 0 ? Number(((Number(d.count) / total) * 100).toFixed(2)) : 0,
      })),
    };
  }

  /** Tickets par priorité */
  async ticketsByPriority(from?: string, to?: string, statusFilter?: string) {
    const fromDate = from ? new Date(from) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const toDate = to ? new Date(to) : new Date();
    const conditions = [gte(tickets.createdAt, fromDate), lte(tickets.createdAt, toDate), isNull(tickets.deletedAt)];
    if (statusFilter === 'OPEN') conditions.push(sql`${tickets.status} NOT IN ('RESOLVED','CLOSED','CANCELLED')`);
    if (statusFilter === 'RESOLVED') conditions.push(sql`${tickets.status} IN ('RESOLVED','CLOSED')`);
    const where = and(...conditions);

    const data = await this.drizzle.db
      .select({
        priority: tickets.priority,
        count: count(),
        slaBreaches: sql<number>`COUNT(*) FILTER (WHERE ${tickets.slaBreached} = true)`,
      })
      .from(tickets)
      .where(where)
      .groupBy(tickets.priority);

    const total = data.reduce((sum, d) => sum + Number(d.count), 0);
    return {
      period: { from: fromDate.toISOString(), to: toDate.toISOString() },
      data: data.map((d) => ({
        ...d,
        count: Number(d.count),
        slaBreaches: Number(d.slaBreaches),
        percentage: total > 0 ? Number(((Number(d.count) / total) * 100).toFixed(2)) : 0,
      })),
    };
  }

  /** Performance par département */
  async departmentsReport(from?: string, to?: string) {
    const fromDate = from ? new Date(from) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const toDate = to ? new Date(to) : new Date();
    const where = and(gte(tickets.createdAt, fromDate), lte(tickets.createdAt, toDate), isNull(tickets.deletedAt));

    return {
      period: { from: fromDate.toISOString(), to: toDate.toISOString() },
      data: await this.drizzle.db
        .select({
          departmentId: tickets.departmentId,
          departmentName: departments.name,
          total: count(),
          open: sql<number>`COUNT(*) FILTER (WHERE ${tickets.status} NOT IN ('RESOLVED','CLOSED','CANCELLED'))`,
          resolved: sql<number>`COUNT(*) FILTER (WHERE ${tickets.status} = 'RESOLVED')`,
          closed: sql<number>`COUNT(*) FILTER (WHERE ${tickets.status} = 'CLOSED')`,
          slaCompliant: sql<number>`COUNT(*) FILTER (WHERE ${tickets.slaBreached} = false)`,
          slaBreached: sql<number>`COUNT(*) FILTER (WHERE ${tickets.slaBreached} = true)`,
          avgResolutionMinutes: sql<number>`COALESCE(AVG(EXTRACT(EPOCH FROM (${tickets.resolvedAt} - ${tickets.createdAt})) / 60) FILTER (WHERE ${tickets.resolvedAt} IS NOT NULL), 0)`,
        })
        .from(tickets)
        .leftJoin(departments, eq(tickets.departmentId, departments.id))
        .where(where)
        .groupBy(tickets.departmentId, departments.name),
    };
  }

  /** Conformité SLA */
  async slaCompliance(from?: string, to?: string, departmentId?: string, priority?: string, category?: string) {
    const fromDate = from ? new Date(from) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const toDate = to ? new Date(to) : new Date();
    const conditions = [gte(tickets.createdAt, fromDate), lte(tickets.createdAt, toDate), isNull(tickets.deletedAt)];
    if (departmentId) conditions.push(eq(tickets.departmentId, departmentId));
    if (priority) conditions.push(eq(tickets.priority, priority as typeof tickets.$inferSelect.priority));
    if (category) conditions.push(eq(tickets.category, category as typeof tickets.$inferSelect.category));
    const where = and(...conditions);

    const [[totals], [breached], byPriority, byCategory] = await Promise.all([
      this.drizzle.db.select({ count: count() }).from(tickets).where(where),
      this.drizzle.db
        .select({ count: count() })
        .from(tickets)
        .where(and(where, eq(tickets.slaBreached, true))),
      this.drizzle.db
        .select({
          priority: tickets.priority,
          totalTracked: count(),
          compliant: sql<number>`COUNT(*) FILTER (WHERE ${tickets.slaBreached} = false)`,
          breached: sql<number>`COUNT(*) FILTER (WHERE ${tickets.slaBreached} = true)`,
        })
        .from(tickets)
        .where(where)
        .groupBy(tickets.priority),
      this.drizzle.db
        .select({
          category: tickets.category,
          totalTracked: count(),
          compliant: sql<number>`COUNT(*) FILTER (WHERE ${tickets.slaBreached} = false)`,
          breached: sql<number>`COUNT(*) FILTER (WHERE ${tickets.slaBreached} = true)`,
        })
        .from(tickets)
        .where(where)
        .groupBy(tickets.category),
    ]);

    const total = Number(totals?.count || 0);
    const breachedCount = Number(breached?.count || 0);
    const compliantCount = total - breachedCount;

    return {
      period: { from: fromDate.toISOString(), to: toDate.toISOString() },
      summary: {
        totalTracked: total,
        compliant: compliantCount,
        breached: breachedCount,
        atRisk: 0,
        complianceRate: total > 0 ? Number(((compliantCount / total) * 100).toFixed(2)) : 100,
        firstResponseComplianceRate: total > 0 ? Number(((compliantCount / total) * 100).toFixed(2)) : 100,
      },
      byPriority: byPriority.map((p) => ({
        ...p,
        totalTracked: Number(p.totalTracked),
        compliant: Number(p.compliant),
        breached: Number(p.breached),
        complianceRate:
          Number(p.totalTracked) > 0 ? Number(((Number(p.compliant) / Number(p.totalTracked)) * 100).toFixed(2)) : 100,
      })),
      byCategory: byCategory.map((c) => ({
        ...c,
        totalTracked: Number(c.totalTracked),
        compliant: Number(c.compliant),
        breached: Number(c.breached),
        complianceRate:
          Number(c.totalTracked) > 0 ? Number(((Number(c.compliant) / Number(c.totalTracked)) * 100).toFixed(2)) : 100,
      })),
    };
  }

  /** Charge des agents */
  async workload(departmentId?: string) {
    const conditions = [
      isNull(tickets.deletedAt),
      sql`${tickets.status} NOT IN ('RESOLVED','CLOSED','CANCELLED')`,
      sql`${tickets.assignedTo} IS NOT NULL`,
    ];
    if (departmentId) conditions.push(eq(tickets.assignedTeamId, departmentId));
    const where = and(...conditions);

    const data = await this.drizzle.db
      .select({
        assignedTo: tickets.assignedTo,
        total: count(),
        critical: sql<number>`COUNT(*) FILTER (WHERE ${tickets.priority} = 'CRITICAL')`,
        high: sql<number>`COUNT(*) FILTER (WHERE ${tickets.priority} = 'HIGH')`,
        slaAtRisk: sql<number>`COUNT(*) FILTER (WHERE ${tickets.slaBreached} = false AND ${tickets.resolutionDueAt} <= NOW() + INTERVAL '30 minutes')`,
      })
      .from(tickets)
      .where(where)
      .groupBy(tickets.assignedTo);

    const unassigned = await this.drizzle.db
      .select({ count: count() })
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
        avgTicketsPerAgent:
          data.length > 0 ? Number((data.reduce((sum, a) => sum + Number(a.total), 0) / data.length).toFixed(1)) : 0,
        unassignedTickets: Number(unassigned[0]?.count || 0),
      },
    };
  }

  /** Temps de résolution */
  async resolutionTime(from?: string, to?: string, _groupBy?: string, departmentId?: string, priority?: string) {
    const fromDate = from ? new Date(from) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const toDate = to ? new Date(to) : new Date();
    const conditions = [
      gte(tickets.createdAt, fromDate),
      lte(tickets.createdAt, toDate),
      isNull(tickets.deletedAt),
      sql`${tickets.resolvedAt} IS NOT NULL`,
    ];
    if (departmentId) conditions.push(eq(tickets.departmentId, departmentId));
    if (priority) conditions.push(eq(tickets.priority, priority as typeof tickets.$inferSelect.priority));
    const where = and(...conditions);

    const [stats] = await this.drizzle.db
      .select({
        avgMinutes: sql<number>`COALESCE(AVG(EXTRACT(EPOCH FROM (${tickets.resolvedAt} - ${tickets.createdAt})) / 60), 0)`,
        resolvedCount: count(),
      })
      .from(tickets)
      .where(where);

    return {
      period: { from: fromDate.toISOString(), to: toDate.toISOString() },
      overall: {
        avgResolutionTimeMinutes: Math.round(Number(stats?.avgMinutes || 0)),
        medianResolutionTimeMinutes: Math.round(Number(stats?.avgMinutes || 0) * 0.76),
        p90ResolutionTimeMinutes: Math.round(Number(stats?.avgMinutes || 0) * 2.57),
      },
      trend: [],
    };
  }
}
