import { ForbiddenException, Injectable } from '@nestjs/common';
import { SQL, and, count, eq, gte, isNull, lte, sql } from 'drizzle-orm';
import { DrizzleProvider } from '../../database/drizzle.provider';
import { tickets } from '../../database/schemas';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

type ResolutionGroupBy = 'day' | 'week' | 'month';

export function resolutionPeriod(groupBy: string | undefined): SQL<Date | string> {
  const safeGroupBy: ResolutionGroupBy = groupBy === 'week' || groupBy === 'month' ? groupBy : 'day';
  const expressions: Record<ResolutionGroupBy, SQL<Date | string>> = {
    day: sql<Date | string>`DATE_TRUNC('day', ${tickets.resolvedAt})`,
    week: sql<Date | string>`DATE_TRUNC('week', ${tickets.resolvedAt})`,
    month: sql<Date | string>`DATE_TRUNC('month', ${tickets.resolvedAt})`,
  };
  return expressions[safeGroupBy];
}

@Injectable()
export class DashboardResolutionService {
  constructor(private readonly drizzle: DrizzleProvider) {}

  private enforceSupervisorScope(departmentId: string | undefined, currentUser?: JwtPayload): string | undefined {
    if (currentUser?.role === 'SUPERVISOR') {
      if (departmentId && departmentId !== currentUser.departmentId) {
        throw new ForbiddenException("Un superviseur ne peut pas accéder aux statistiques d'un autre département.");
      }
      return currentUser.departmentId;
    }
    return departmentId;
  }

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
      .select({ period: periodExpression, avgResolutionTimeMinutes: sql<number>`COALESCE(AVG(${durationMinutes}), 0)` })
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
        resolvedCount: Number(stats?.resolvedCount || 0),
      },
      trend: trend.map((point) => ({
        period: new Date(point.period).toISOString(),
        avgResolutionTimeMinutes: Number(point.avgResolutionTimeMinutes),
      })),
    };
  }
}
