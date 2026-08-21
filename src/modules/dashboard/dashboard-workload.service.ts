import { ForbiddenException, Injectable } from '@nestjs/common';
import { and, count, eq, inArray, isNull, sql } from 'drizzle-orm';
import { DrizzleProvider } from '../../database/drizzle.provider';
import { departments, ticketHistory, tickets, users } from '../../database/schemas';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

@Injectable()
export class DashboardWorkloadService {
  constructor(private readonly drizzle: DrizzleProvider) {}

  private enforceSupervisorScope(departmentId: string | undefined, currentUser?: JwtPayload): string | undefined {
    if (currentUser?.role === 'SUPERVISOR') {
      if (departmentId && departmentId !== currentUser.departmentId)
        throw new ForbiddenException("Un superviseur ne peut pas accéder aux statistiques d'un autre département.");
      return currentUser.departmentId;
    }
    return departmentId;
  }

  private performanceScore(
    slaBreachedCount: number,
    resolvedInPeriod: number,
    avgResolutionMinutes: number,
    reopenedCount: number,
  ): number {
    const slaScore = Math.max(0, 100 - slaBreachedCount * 10);
    const volumeScore = Math.min(100, resolvedInPeriod * 5);
    const speedScore = Math.max(0, 100 - Math.round(avgResolutionMinutes / 6));
    const reopenScore = Math.max(0, 100 - reopenedCount * 20);
    return Math.round(0.4 * slaScore + 0.3 * volumeScore + 0.2 * speedScore + 0.1 * reopenScore);
  }

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
        isAvailable: users.isAvailable,
        absenceEndsAt: users.absenceEndsAt,
        openTicketsCount: count(),
        criticalTicketsCount: sql<number>`COUNT(*) FILTER (WHERE ${tickets.priority} = 'CRITICAL')`,
        highTicketsCount: sql<number>`COUNT(*) FILTER (WHERE ${tickets.priority} = 'HIGH')`,
        slaAtRiskCount: sql<number>`COUNT(*) FILTER (WHERE ${tickets.resolutionDueAt} <= NOW() + INTERVAL '30 minutes')`,
        overdueTicketsCount: sql<number>`COUNT(*) FILTER (WHERE ${tickets.resolutionDueAt} < NOW())`,
        lastActivityAt: sql<Date>`MAX(${tickets.updatedAt})`,
      })
      .from(tickets)
      .leftJoin(users, eq(tickets.assignedTo, users.id))
      .where(where)
      .groupBy(
        tickets.assignedTo,
        users.firstName,
        users.lastName,
        users.email,
        users.isAvailable,
        users.absenceEndsAt,
      );
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
    const now = new Date();
    const absentAgentsCount = data.filter(
      (agent) => agent.isAvailable === false || (agent.absenceEndsAt ? new Date(agent.absenceEndsAt) > now : false),
    ).length;
    return {
      generatedAt: new Date().toISOString(),
      data: data.map((a) => ({
        ...a,
        openTicketsCount: Number(a.openTicketsCount || 0),
        criticalTicketsCount: Number(a.criticalTicketsCount || 0),
        highTicketsCount: Number(a.highTicketsCount || 0),
        slaAtRiskCount: Number(a.slaAtRiskCount || 0),
        overdueTicketsCount: Number(a.overdueTicketsCount || 0),
        lastActivityAt: a.lastActivityAt ? new Date(a.lastActivityAt).toISOString() : null,
      })),
      summary: {
        totalAgents: data.length,
        totalOpenTickets: data.reduce((sum, a) => sum + Number(a.openTicketsCount), 0),
        absentAgentsCount,
        avgTicketsPerAgent:
          data.length > 0
            ? Number((data.reduce((sum, a) => sum + Number(a.openTicketsCount), 0) / data.length).toFixed(1))
            : 0,
        unassignedTickets: Number(unassigned[0]?.count || 0),
      },
    };
  }

  async agentPerformance(from?: string, to?: string, currentUser?: JwtPayload) {
    const fromDate = from ? new Date(from) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const toDate = to ? new Date(to) : new Date();
    const now = new Date();
    const targetDeptId = this.enforceSupervisorScope(undefined, currentUser);
    const conditions = [isNull(tickets.deletedAt), sql`${tickets.assignedTo} IS NOT NULL`];
    if (targetDeptId) conditions.push(eq(tickets.assignedTeamId, targetDeptId));
    const where = and(...conditions);
    const openStatus = sql`${tickets.status} NOT IN ('RESOLVED','CLOSED','CANCELLED')`;
    const durationMinutes = sql<number>`EXTRACT(EPOCH FROM (${tickets.resolvedAt} - ${tickets.createdAt})) / 60`;
    const rows = await this.drizzle.db
      .select({
        agentId: tickets.assignedTo,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        role: users.role,
        isAvailable: users.isAvailable,
        absenceEndsAt: users.absenceEndsAt,
        departmentName: departments.name,
        openTicketsCount: sql<number>`COUNT(*) FILTER (WHERE ${openStatus})`,
        criticalTicketsCount: sql<number>`COUNT(*) FILTER (WHERE ${openStatus} AND ${tickets.priority} = 'CRITICAL')`,
        overdueTicketsCount: sql<number>`COUNT(*) FILTER (WHERE ${openStatus} AND ${tickets.resolutionDueAt} < ${now.toISOString()})`,
        atRiskTicketsCount: sql<number>`COUNT(*) FILTER (WHERE ${openStatus} AND ${tickets.resolutionDueAt} <= ${new Date(now.getTime() + 30 * 60 * 1000).toISOString()})`,
        resolvedInPeriod: sql<number>`COUNT(*) FILTER (WHERE ${tickets.resolvedAt} >= ${fromDate.toISOString()} AND ${tickets.resolvedAt} <= ${toDate.toISOString()})`,
        closedInPeriod: sql<number>`COUNT(*) FILTER (WHERE ${tickets.closedAt} >= ${fromDate.toISOString()} AND ${tickets.closedAt} <= ${toDate.toISOString()})`,
        slaBreachedCount: sql<number>`COUNT(*) FILTER (WHERE ${tickets.slaBreached} = true)`,
        firstResponseCompliant: sql<number>`COUNT(*) FILTER (WHERE ${tickets.firstResponseAt} IS NOT NULL AND ${tickets.firstResponseAt} <= ${tickets.firstResponseDueAt})`,
        firstResponseCount: sql<number>`COUNT(*) FILTER (WHERE ${tickets.firstResponseAt} IS NOT NULL)`,
        avgResolutionMinutes: sql<number>`COALESCE(AVG(${durationMinutes}) FILTER (WHERE ${tickets.resolvedAt} >= ${fromDate.toISOString()} AND ${tickets.resolvedAt} <= ${toDate.toISOString()}), 0)`,
        medianResolutionMinutes: sql<number>`COALESCE(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ${durationMinutes}) FILTER (WHERE ${tickets.resolvedAt} >= ${fromDate.toISOString()} AND ${tickets.resolvedAt} <= ${toDate.toISOString()}), 0)`,
        lastActivityAt: sql<Date>`MAX(${tickets.updatedAt})`,
      })
      .from(tickets)
      .leftJoin(users, eq(tickets.assignedTo, users.id))
      .leftJoin(departments, eq(tickets.assignedTeamId, departments.id))
      .where(where)
      .groupBy(
        tickets.assignedTo,
        users.firstName,
        users.lastName,
        users.email,
        users.role,
        users.isAvailable,
        users.absenceEndsAt,
        departments.name,
      )
      .orderBy(users.firstName, users.lastName);
    const agentIds = rows.map((row) => row.agentId).filter((id): id is string => Boolean(id));
    const reopenedRows =
      agentIds.length > 0
        ? await this.drizzle.db
            .select({ agentId: tickets.assignedTo, reopenedCount: count() })
            .from(ticketHistory)
            .innerJoin(tickets, eq(ticketHistory.ticketId, tickets.id))
            .where(
              and(
                eq(ticketHistory.action, 'STATUS_CHANGED'),
                sql`${ticketHistory.newValue}->>'status' = 'REOPENED'`,
                inArray(tickets.assignedTo, agentIds),
              ),
            )
            .groupBy(tickets.assignedTo)
        : [];
    const reopenedByAgent = new Map(reopenedRows.map((row) => [row.agentId, Number(row.reopenedCount)]));
    const mergedRows: typeof rows = [];
    const byAgent = new Map<string, (typeof rows)[number]>();
    const countFields = [
      'openTicketsCount',
      'criticalTicketsCount',
      'overdueTicketsCount',
      'atRiskTicketsCount',
      'resolvedInPeriod',
      'closedInPeriod',
      'slaBreachedCount',
      'firstResponseCompliant',
      'firstResponseCount',
    ] as const;
    for (const row of rows) {
      const key = row.agentId ?? '';
      const existing = key ? byAgent.get(key) : undefined;
      if (!existing) {
        byAgent.set(key, { ...row });
        mergedRows.push(row);
        continue;
      }
      for (const field of countFields) existing[field] = Number(existing[field] || 0) + Number(row[field] || 0);
      if (row.lastActivityAt && (!existing.lastActivityAt || row.lastActivityAt > existing.lastActivityAt))
        existing.lastActivityAt = row.lastActivityAt;
    }
    return {
      generatedAt: now.toISOString(),
      period: { from: fromDate.toISOString(), to: toDate.toISOString() },
      data: mergedRows.map((row) => {
        const agentId = row.agentId;
        const resolved = Number(row.resolvedInPeriod || 0);
        const firstResponseCount = Number(row.firstResponseCount || 0);
        const firstResponseComplianceRate =
          firstResponseCount > 0
            ? Math.round((Number(row.firstResponseCompliant || 0) / firstResponseCount) * 100)
            : 100;
        const reopenedCount = agentId ? (reopenedByAgent.get(agentId) ?? 0) : 0;
        const avgResolutionMinutes = Math.round(Number(row.avgResolutionMinutes || 0));
        const score = this.performanceScore(
          Number(row.slaBreachedCount || 0),
          resolved,
          avgResolutionMinutes,
          reopenedCount,
        );
        return {
          agentId,
          firstName: row.firstName,
          lastName: row.lastName,
          email: row.email,
          role: row.role,
          isAvailable: row.isAvailable,
          absenceEndsAt: row.absenceEndsAt ? new Date(row.absenceEndsAt).toISOString() : null,
          departmentName: row.departmentName,
          openTicketsCount: Number(row.openTicketsCount || 0),
          criticalTicketsCount: Number(row.criticalTicketsCount || 0),
          overdueTicketsCount: Number(row.overdueTicketsCount || 0),
          atRiskTicketsCount: Number(row.atRiskTicketsCount || 0),
          resolvedInPeriod: resolved,
          closedInPeriod: Number(row.closedInPeriod || 0),
          slaBreachedCount: Number(row.slaBreachedCount || 0),
          firstResponseComplianceRate,
          avgResolutionMinutes,
          medianResolutionMinutes: Math.round(Number(row.medianResolutionMinutes || 0)),
          reopenedCount,
          score,
          lastActivityAt: row.lastActivityAt ? new Date(row.lastActivityAt).toISOString() : null,
        };
      }),
    };
  }

  async myActivity(currentUser: JwtPayload) {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const openStatus = sql`${tickets.status} NOT IN ('RESOLVED','CLOSED','CANCELLED')`;
    const where = and(isNull(tickets.deletedAt), eq(tickets.assignedTo, currentUser.sub));
    const durationMinutes = sql<number>`EXTRACT(EPOCH FROM (${tickets.resolvedAt} - ${tickets.createdAt})) / 60`;
    const sevenDaysAgo = new Date(now.getTime() - 6 * 24 * 3_600_000);
    const [[stats], [profile], reopenedRows, trendRows] = await Promise.all([
      this.drizzle.db
        .select({
          totalAssigned: sql<number>`COUNT(*)`,
          openTicketsCount: sql<number>`COUNT(*) FILTER (WHERE ${openStatus})`,
          criticalTicketsCount: sql<number>`COUNT(*) FILTER (WHERE ${openStatus} AND ${tickets.priority} = 'CRITICAL')`,
          overdueTicketsCount: sql<number>`COUNT(*) FILTER (WHERE ${openStatus} AND ${tickets.resolutionDueAt} < ${now.toISOString()})`,
          atRiskTicketsCount: sql<number>`COUNT(*) FILTER (WHERE ${openStatus} AND ${tickets.resolutionDueAt} <= ${new Date(now.getTime() + 30 * 60 * 1000).toISOString()})`,
          resolvedThisMonth: sql<number>`COUNT(*) FILTER (WHERE ${tickets.resolvedAt} >= ${monthStart.toISOString()})`,
          closedThisMonth: sql<number>`COUNT(*) FILTER (WHERE ${tickets.closedAt} >= ${monthStart.toISOString()})`,
          slaBreachedCount: sql<number>`COUNT(*) FILTER (WHERE ${tickets.slaBreached} = true)`,
          firstResponseCount: sql<number>`COUNT(*) FILTER (WHERE ${tickets.firstResponseAt} IS NOT NULL)`,
          firstResponseCompliant: sql<number>`COUNT(*) FILTER (WHERE ${tickets.firstResponseAt} IS NOT NULL AND ${tickets.firstResponseAt} <= ${tickets.firstResponseDueAt})`,
          avgResolutionMinutes: sql<number>`COALESCE(AVG(${durationMinutes}) FILTER (WHERE ${tickets.resolvedAt} >= ${monthStart.toISOString()}), 0)`,
          medianResolutionMinutes: sql<number>`COALESCE(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ${durationMinutes}) FILTER (WHERE ${tickets.resolvedAt} >= ${monthStart.toISOString()}), 0)`,
          lastActivityAt: sql<Date>`MAX(${tickets.updatedAt})`,
        })
        .from(tickets)
        .where(where),
      this.drizzle.db
        .select({
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
          role: users.role,
          departmentName: departments.name,
          isAvailable: users.isAvailable,
          absenceEndsAt: users.absenceEndsAt,
        })
        .from(users)
        .leftJoin(departments, eq(users.departmentId, departments.id))
        .where(eq(users.id, currentUser.sub))
        .limit(1),
      this.drizzle.db
        .select({ reopenedCount: count() })
        .from(ticketHistory)
        .innerJoin(tickets, eq(ticketHistory.ticketId, tickets.id))
        .where(
          and(
            eq(ticketHistory.action, 'STATUS_CHANGED'),
            sql`${ticketHistory.newValue}->>'status' = 'REOPENED'`,
            eq(tickets.assignedTo, currentUser.sub),
          ),
        )
        .groupBy(tickets.assignedTo),
      this.drizzle.db
        .select({ day: sql<string>`TO_CHAR(${tickets.resolvedAt}, 'YYYY-MM-DD')`, count: count() })
        .from(tickets)
        .where(
          and(
            isNull(tickets.deletedAt),
            eq(tickets.assignedTo, currentUser.sub),
            sql`${tickets.resolvedAt} >= ${sevenDaysAgo.toISOString()}`,
          ),
        )
        .groupBy(sql`TO_CHAR(${tickets.resolvedAt}, 'YYYY-MM-DD')`)
        .orderBy(sql`TO_CHAR(${tickets.resolvedAt}, 'YYYY-MM-DD')`),
    ]);
    const reopenedCount = reopenedRows.length > 0 ? Number(reopenedRows[0].reopenedCount || 0) : 0;
    const firstResponseCount = Number(stats?.firstResponseCount || 0);
    const firstResponseComplianceRate =
      firstResponseCount > 0
        ? Math.round((Number(stats?.firstResponseCompliant || 0) / firstResponseCount) * 100)
        : 100;
    return {
      generatedAt: now.toISOString(),
      profile: profile
        ? {
            firstName: profile.firstName,
            lastName: profile.lastName,
            email: profile.email,
            role: profile.role,
            departmentName: profile.departmentName,
            isAvailable: profile.isAvailable,
            absenceEndsAt: profile.absenceEndsAt ? new Date(profile.absenceEndsAt).toISOString() : null,
          }
        : null,
      summary: {
        totalAssigned: Number(stats?.totalAssigned || 0),
        openTicketsCount: Number(stats?.openTicketsCount || 0),
        criticalTicketsCount: Number(stats?.criticalTicketsCount || 0),
        overdueTicketsCount: Number(stats?.overdueTicketsCount || 0),
        atRiskTicketsCount: Number(stats?.atRiskTicketsCount || 0),
        resolvedThisMonth: Number(stats?.resolvedThisMonth || 0),
        closedThisMonth: Number(stats?.closedThisMonth || 0),
        slaBreachedCount: Number(stats?.slaBreachedCount || 0),
        firstResponseCount,
        firstResponseComplianceRate,
        avgResolutionMinutes: Math.round(Number(stats?.avgResolutionMinutes || 0)),
        medianResolutionMinutes: Math.round(Number(stats?.medianResolutionMinutes || 0)),
        reopenedCount,
        resolvedLast7Days: trendRows.map((row) => ({ day: row.day, count: Number(row.count || 0) })),
        lastActivityAt: stats?.lastActivityAt ? new Date(stats.lastActivityAt).toISOString() : null,
      },
    };
  }
}
