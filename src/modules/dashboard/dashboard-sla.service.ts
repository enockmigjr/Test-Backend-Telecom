import { ForbiddenException, Injectable } from '@nestjs/common';
import { and, count, eq, gte, isNull, lte, sql } from 'drizzle-orm';
import { DrizzleProvider } from '../../database/drizzle.provider';
import { categories, tickets } from '../../database/schemas';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

interface SlaBreakdown {
  readonly totalTracked: number;
  readonly compliant: number;
  readonly breached: number;
  readonly firstResponseBreached: number;
  readonly resolutionBreached: number;
}

@Injectable()
export class DashboardSlaService {
  constructor(private readonly drizzle: DrizzleProvider) {}

  async compliance(
    from?: string,
    to?: string,
    departmentId?: string,
    priority?: string,
    categoryId?: string,
    currentUser?: JwtPayload,
  ) {
    const fromDate = from ? new Date(from) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const toDate = to ? new Date(to) : new Date();
    const targetDepartmentId = this.enforceSupervisorScope(departmentId, currentUser);
    const conditions = [gte(tickets.createdAt, fromDate), lte(tickets.createdAt, toDate), isNull(tickets.deletedAt)];
    if (targetDepartmentId) conditions.push(eq(tickets.assignedTeamId, targetDepartmentId));
    if (priority) conditions.push(eq(tickets.priority, priority as typeof tickets.$inferSelect.priority));
    if (categoryId) conditions.push(eq(tickets.categoryId, categoryId));
    const where = and(...conditions);

    const fields = {
      totalTracked: count(),
      compliant: sql<number>`COUNT(*) FILTER (WHERE ${tickets.slaBreached} = false)`,
      breached: sql<number>`COUNT(*) FILTER (WHERE ${tickets.slaBreached} = true)`,
      firstResponseBreached: sql<number>`COUNT(*) FILTER (WHERE ${tickets.firstResponseBreachedAt} IS NOT NULL)`,
      resolutionBreached: sql<number>`COUNT(*) FILTER (WHERE ${tickets.resolutionBreachedAt} IS NOT NULL)`,
    };
    const [[totals], byPriority, byCategory] = await Promise.all([
      this.drizzle.db.select(fields).from(tickets).where(where),
      this.drizzle.db
        .select({ priority: tickets.priority, ...fields })
        .from(tickets)
        .where(where)
        .groupBy(tickets.priority),
      this.drizzle.db
        .select({ category: categories.name, ...fields })
        .from(tickets)
        .leftJoin(categories, eq(tickets.categoryId, categories.id))
        .where(where)
        .groupBy(categories.name),
    ]);
    const summary = this.normalize(totals ?? this.emptyBreakdown());

    return {
      period: { from: fromDate.toISOString(), to: toDate.toISOString() },
      summary: { ...summary, atRisk: 0 },
      byPriority: byPriority.map((row) => ({ priority: row.priority, ...this.normalize(row) })),
      byCategory: byCategory.map((row) => ({ category: row.category, ...this.normalize(row) })),
    };
  }

  private normalize(values: SlaBreakdown) {
    const totalTracked = Number(values.totalTracked);
    const compliant = Number(values.compliant);
    const breached = Number(values.breached);
    const firstResponseBreached = Number(values.firstResponseBreached);
    const resolutionBreached = Number(values.resolutionBreached);
    return {
      totalTracked,
      compliant,
      breached,
      firstResponseBreached,
      resolutionBreached,
      complianceRate: this.rate(compliant, totalTracked),
      firstResponseComplianceRate: this.rate(totalTracked - firstResponseBreached, totalTracked),
      resolutionComplianceRate: this.rate(totalTracked - resolutionBreached, totalTracked),
    };
  }

  private rate(compliant: number, total: number): number {
    return total > 0 ? Number(((compliant / total) * 100).toFixed(2)) : 100;
  }

  private emptyBreakdown(): SlaBreakdown {
    return { totalTracked: 0, compliant: 0, breached: 0, firstResponseBreached: 0, resolutionBreached: 0 };
  }

  private enforceSupervisorScope(departmentId: string | undefined, user?: JwtPayload): string | undefined {
    if (user?.role !== 'SUPERVISOR') return departmentId;
    if (departmentId && departmentId !== user.departmentId) {
      throw new ForbiddenException("Un superviseur ne peut pas acceder aux statistiques d'un autre departement.");
    }
    return user.departmentId;
  }
}
