import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { and, count, eq, gt, gte, isNull, lt, lte, sql } from 'drizzle-orm';
import { DrizzleProvider } from '../../database/drizzle.provider';
import { tickets } from '../../database/schemas';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

@Injectable()
export class DashboardOverviewService {
  private readonly logger = new Logger(DashboardOverviewService.name);
  private readonly cache = new Map<string, { value: unknown; expiresAt: number }>();
  private readonly CACHE_TTL_MS = 60_000;

  constructor(private readonly drizzle: DrizzleProvider) {}

  private cacheKey(from?: string, to?: string, user?: JwtPayload): string {
    return `overview:${from ?? ''}:${to ?? ''}:${user?.role ?? ''}:${user?.departmentId ?? ''}`;
  }

  private enforceSupervisorScope(
    departmentId: string | undefined,
    currentUser?: JwtPayload,
  ): string | undefined {
    if (currentUser?.role === 'SUPERVISOR') {
      if (departmentId && departmentId !== currentUser.departmentId) {
        throw new ForbiddenException("Un superviseur ne peut pas accéder aux statistiques d'un autre département.");
      }
      return currentUser.departmentId;
    }
    return departmentId;
  }

  async overview(from?: string, to?: string, currentUser?: JwtPayload) {
    const key = this.cacheKey(from, to, currentUser);
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      this.logger.debug(`Dashboard overview cache hit: ${key}`);
      return cached.value as Awaited<ReturnType<DashboardOverviewService['overview']>>;
    }
    const fromDate = from ? new Date(from) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const toDate = to ? new Date(to) : new Date();
    const conditions = [gte(tickets.createdAt, fromDate), lte(tickets.createdAt, toDate), isNull(tickets.deletedAt)];
    if (currentUser?.role === 'SUPERVISOR') {
      conditions.push(eq(tickets.assignedTeamId, currentUser.departmentId));
    }
    const rangeWhere = and(...conditions);
    const slaScope = [isNull(tickets.deletedAt), sql`${tickets.status} NOT IN ('RESOLVED','CLOSED','CANCELLED')`];
    if (currentUser?.role === 'SUPERVISOR') slaScope.push(eq(tickets.assignedTeamId, currentUser.departmentId));
    const openWhere = and(...slaScope);
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const todayScope = [isNull(tickets.deletedAt)];
    if (currentUser?.role === 'SUPERVISOR') {
      todayScope.push(eq(tickets.assignedTeamId, currentUser.departmentId));
    }
    const [
      [totals],
      [openTickets],
      [],
      [resolvedToday],
      [createdToday],
      [breachedCount],
      [atRiskCount],
      [overdueCount],
      [compliantCount],
    ] = await Promise.all([
      this.drizzle.db.select({ total: count() }).from(tickets).where(rangeWhere),
      this.drizzle.db.select({ count: count() }).from(tickets).where(openWhere),
      this.drizzle.db.select({ count: count() }).from(tickets).where(and(openWhere, eq(tickets.priority, 'CRITICAL' as const))),
      this.drizzle.db.select({ count: count() }).from(tickets).where(and(...todayScope, gte(tickets.resolvedAt, todayStart), lt(tickets.resolvedAt, tomorrowStart))),
      this.drizzle.db.select({ count: count() }).from(tickets).where(and(...todayScope, gte(tickets.createdAt, todayStart), lt(tickets.createdAt, tomorrowStart))),
      this.drizzle.db.select({ count: count() }).from(tickets).where(and(openWhere, eq(tickets.slaBreached, true))),
      this.drizzle.db.select({ count: count() }).from(tickets).where(and(openWhere, gt(tickets.resolutionDueAt, new Date()), lte(tickets.resolutionDueAt, new Date(Date.now() + 30 * 60 * 1000)))),
      this.drizzle.db.select({ count: count() }).from(tickets).where(and(openWhere, lt(tickets.resolutionDueAt, new Date()))),
      this.drizzle.db.select({ count: count() }).from(tickets).where(and(openWhere, eq(tickets.slaBreached, false))),
    ]);
    const byStatus = await this.drizzle.db.select({ status: tickets.status, count: count() }).from(tickets).where(rangeWhere).groupBy(tickets.status);
    const byPriority = await this.drizzle.db.select({ priority: tickets.priority, count: count() }).from(tickets).where(rangeWhere).groupBy(tickets.priority);
    const bySeverity = await this.drizzle.db.select({ severity: tickets.severity, count: count() }).from(tickets).where(rangeWhere).groupBy(tickets.severity);
    const total = Number(totals?.total || 0);
    const openTotal = Number(openTickets?.count || 0);
    const compliant = Number(compliantCount?.count || 0);
    const atRiskExclusive = Math.max(0, Number(atRiskCount?.count || 0) - Number(overdueCount?.count || 0));
    const result = {
      period: { from: fromDate.toISOString(), to: toDate.toISOString() },
      ticketVolume: { total, openTickets: openTotal, resolvedToday: Number(resolvedToday?.count || 0), createdToday: Number(createdToday?.count || 0) },
      byStatus: Object.fromEntries(byStatus.map((s) => [s.status, Number(s.count)])),
      byPriority: Object.fromEntries(byPriority.map((p) => [p.priority, Number(p.count)])),
      bySeverity: Object.fromEntries(bySeverity.map((s) => [s.severity, Number(s.count)])),
      sla: {
        totalTracked: openTotal,
        breached: Number(breachedCount?.count || 0),
        atRisk: atRiskExclusive > 0 ? atRiskExclusive : Number(atRiskCount?.count || 0),
        overdue: Number(overdueCount?.count || 0),
        compliant,
        complianceRate: openTotal > 0 ? Number(((compliant / openTotal) * 100).toFixed(2)) : 100,
      },
    };
    this.cache.set(key, { value: result, expiresAt: Date.now() + this.CACHE_TTL_MS });
    // éviter fuite mémoire : purge les expirés si >200 entrées
    if (this.cache.size > 200) {
      const now = Date.now();
      for (const [k, v] of this.cache.entries()) if (v.expiresAt <= now) this.cache.delete(k);
    }
    return result;
  }
}
