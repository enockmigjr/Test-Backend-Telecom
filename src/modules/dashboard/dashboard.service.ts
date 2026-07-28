import { Injectable, ForbiddenException } from '@nestjs/common';
import { and, gte, lt, lte, eq, sql, isNull, count, SQL } from 'drizzle-orm';
import { DrizzleProvider } from '../../database/drizzle.provider';
import { tickets, departments, users } from '../../database/schemas';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { DashboardSlaService } from './dashboard-sla.service';

type ResolutionGroupBy = 'day' | 'week' | 'month';

function resolutionPeriod(groupBy: string | undefined): SQL<Date | string> {
  const safeGroupBy: ResolutionGroupBy = groupBy === 'week' || groupBy === 'month' ? groupBy : 'day';
  const expressions: Record<ResolutionGroupBy, SQL<Date | string>> = {
    day: sql<Date | string>`DATE_TRUNC('day', ${tickets.resolvedAt})`,
    week: sql<Date | string>`DATE_TRUNC('week', ${tickets.resolvedAt})`,
    month: sql<Date | string>`DATE_TRUNC('month', ${tickets.resolvedAt})`,
  };
  return expressions[safeGroupBy];
}

@Injectable()
export class DashboardService {
  constructor(
    private readonly drizzle: DrizzleProvider,
    private readonly dashboardSla: DashboardSlaService,
  ) {}

  private enforceSupervisorScope(departmentId: string | undefined, currentUser?: JwtPayload): string | undefined {
    if (currentUser?.role === 'SUPERVISOR') {
      if (departmentId && departmentId !== currentUser.departmentId) {
        throw new ForbiddenException("Un superviseur ne peut pas acceder aux statistiques d'un autre departement.");
      }
      return currentUser.departmentId;
    }
    return departmentId;
  }

  /** KPIs globaux de la plateforme */
  async overview(from?: string, to?: string, currentUser?: JwtPayload) {
    const fromDate = from ? new Date(from) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const toDate = to ? new Date(to) : new Date();

    const conditions = [gte(tickets.createdAt, fromDate), lte(tickets.createdAt, toDate), isNull(tickets.deletedAt)];
    if (currentUser?.role === 'SUPERVISOR') {
      conditions.push(eq(tickets.assignedTeamId, currentUser.departmentId));
    }

    const rangeWhere = and(...conditions);
    const openWhere = and(rangeWhere, sql`${tickets.status} NOT IN ('RESOLVED','CLOSED','CANCELLED')`);
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const todayScope = [isNull(tickets.deletedAt)];
    if (currentUser?.role === 'SUPERVISOR') {
      todayScope.push(eq(tickets.assignedTeamId, currentUser.departmentId));
    }

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
          .where(and(...todayScope, gte(tickets.resolvedAt, todayStart), lt(tickets.resolvedAt, tomorrowStart))),
        this.drizzle.db
          .select({ count: count() })
          .from(tickets)
          .where(and(...todayScope, gte(tickets.createdAt, todayStart), lt(tickets.createdAt, tomorrowStart))),
        this.drizzle.db
          .select({ count: count() })
          .from(tickets)
          .where(and(openWhere, eq(tickets.slaBreached, true))),
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
  async ticketsByStatus(from?: string, to?: string, departmentId?: string, currentUser?: JwtPayload) {
    const fromDate = from ? new Date(from) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const toDate = to ? new Date(to) : new Date();

    const targetDeptId = this.enforceSupervisorScope(departmentId, currentUser);

    const conditions = [gte(tickets.createdAt, fromDate), lte(tickets.createdAt, toDate), isNull(tickets.deletedAt)];
    if (targetDeptId) conditions.push(eq(tickets.assignedTeamId, targetDeptId));
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
  async ticketsByPriority(
    from?: string,
    to?: string,
    statusFilter?: string,
    currentUser?: JwtPayload,
    departmentId?: string,
  ) {
    const fromDate = from ? new Date(from) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const toDate = to ? new Date(to) : new Date();

    const targetDeptId = this.enforceSupervisorScope(departmentId, currentUser);

    const conditions = [gte(tickets.createdAt, fromDate), lte(tickets.createdAt, toDate), isNull(tickets.deletedAt)];
    if (statusFilter === 'OPEN') conditions.push(sql`${tickets.status} NOT IN ('RESOLVED','CLOSED','CANCELLED')`);
    if (statusFilter === 'RESOLVED') conditions.push(sql`${tickets.status} IN ('RESOLVED','CLOSED')`);
    if (targetDeptId) conditions.push(eq(tickets.assignedTeamId, targetDeptId));
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
  async departmentsReport(from?: string, to?: string, currentUser?: JwtPayload) {
    const fromDate = from ? new Date(from) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const toDate = to ? new Date(to) : new Date();
    const conditions = [gte(tickets.createdAt, fromDate), lte(tickets.createdAt, toDate), isNull(tickets.deletedAt)];
    const targetDeptId = this.enforceSupervisorScope(undefined, currentUser);
    if (targetDeptId) conditions.push(eq(tickets.assignedTeamId, targetDeptId));
    const where = and(...conditions);

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
  async slaCompliance(
    from?: string,
    to?: string,
    departmentId?: string,
    priority?: string,
    categoryId?: string,
    currentUser?: JwtPayload,
  ) {
    return this.dashboardSla.compliance(from, to, departmentId, priority, categoryId, currentUser);
  }

  /** Charge des agents */
  async workload(departmentId?: string, currentUser?: JwtPayload) {
    const targetDeptId = this.enforceSupervisorScope(departmentId, currentUser);

    const conditions = [
      isNull(tickets.deletedAt),
      sql`${tickets.status} NOT IN ('RESOLVED','CLOSED','CANCELLED')`,
      sql`${tickets.assignedTo} IS NOT NULL`,
    ];
    if (targetDeptId) conditions.push(eq(tickets.assignedTeamId, targetDeptId));
    const where = and(...conditions);

    const data = await this.drizzle.db
      .select({
        agentId: tickets.assignedTo,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        openTicketsCount: count(),
        criticalTicketsCount: sql<number>`COUNT(*) FILTER (WHERE ${tickets.priority} = 'CRITICAL')`,
        highTicketsCount: sql<number>`COUNT(*) FILTER (WHERE ${tickets.priority} = 'HIGH')`,
        slaAtRiskCount: sql<number>`COUNT(*) FILTER (WHERE ${tickets.slaBreached} = false AND ${tickets.resolutionDueAt} <= NOW() + INTERVAL '30 minutes')`,
      })
      .from(tickets)
      .leftJoin(users, eq(tickets.assignedTo, users.id))
      .where(where)
      .groupBy(tickets.assignedTo, users.firstName, users.lastName, users.email);

    const unassignedConditions = [
      isNull(tickets.deletedAt),
      sql`${tickets.status} NOT IN ('RESOLVED','CLOSED','CANCELLED')`,
      sql`${tickets.assignedTo} IS NULL`,
    ];
    if (targetDeptId) unassignedConditions.push(eq(tickets.assignedTeamId, targetDeptId));

    const unassigned = await this.drizzle.db
      .select({ count: count() })
      .from(tickets)
      .where(and(...unassignedConditions));

    return {
      generatedAt: new Date().toISOString(),
      data: data.map((a) => ({
        ...a,
        openTicketsCount: Number(a.openTicketsCount || 0),
        criticalTicketsCount: Number(a.criticalTicketsCount || 0),
        highTicketsCount: Number(a.highTicketsCount || 0),
        slaAtRiskCount: Number(a.slaAtRiskCount || 0),
      })),
      summary: {
        totalAgents: data.length,
        totalOpenTickets: data.reduce((sum, a) => sum + Number(a.openTicketsCount), 0),
        avgTicketsPerAgent:
          data.length > 0
            ? Number((data.reduce((sum, a) => sum + Number(a.openTicketsCount), 0) / data.length).toFixed(1))
            : 0,
        unassignedTickets: Number(unassigned[0]?.count || 0),
      },
    };
  }

  /** Temps de résolution */
  async resolutionTime(
    from?: string,
    to?: string,
    groupBy?: string,
    departmentId?: string,
    priority?: string,
    currentUser?: JwtPayload,
  ) {
    const fromDate = from ? new Date(from) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const toDate = to ? new Date(to) : new Date();

    const targetDeptId = this.enforceSupervisorScope(departmentId, currentUser);

    const conditions = [
      gte(tickets.resolvedAt, fromDate),
      lte(tickets.resolvedAt, toDate),
      isNull(tickets.deletedAt),
      sql`${tickets.resolvedAt} IS NOT NULL`,
    ];
    if (targetDeptId) conditions.push(eq(tickets.assignedTeamId, targetDeptId));
    if (priority) conditions.push(eq(tickets.priority, priority as typeof tickets.$inferSelect.priority));
    const where = and(...conditions);
    const periodExpression = resolutionPeriod(groupBy);
    const durationMinutes = sql<number>`EXTRACT(EPOCH FROM (${tickets.resolvedAt} - ${tickets.createdAt})) / 60`;

    const [stats] = await this.drizzle.db
      .select({
        avgMinutes: sql<number>`COALESCE(AVG(${durationMinutes}), 0)`,
        medianMinutes: sql<number>`COALESCE(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ${durationMinutes}), 0)`,
        p90Minutes: sql<number>`COALESCE(PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY ${durationMinutes}), 0)`,
        resolvedCount: count(),
      })
      .from(tickets)
      .where(where);

    const trend = await this.drizzle.db
      .select({
        period: periodExpression,
        avgResolutionTimeMinutes: sql<number>`COALESCE(AVG(${durationMinutes}), 0)`,
      })
      .from(tickets)
      .where(where)
      .groupBy(periodExpression)
      .orderBy(periodExpression);

    return {
      period: { from: fromDate.toISOString(), to: toDate.toISOString() },
      overall: {
        avgResolutionTimeMinutes: Math.round(Number(stats?.avgMinutes || 0)),
        medianResolutionTimeMinutes: Math.round(Number(stats?.medianMinutes || 0)),
        p90ResolutionTimeMinutes: Math.round(Number(stats?.p90Minutes || 0)),
      },
      trend: trend.map((point) => ({
        period: new Date(point.period).toISOString(),
        avgResolutionTimeMinutes: Number(point.avgResolutionTimeMinutes),
      })),
    };
  }
}
