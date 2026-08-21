import { ForbiddenException, Injectable, Optional } from '@nestjs/common';
import { and, count, eq, gte, isNull, lte, sql } from 'drizzle-orm';
import { DrizzleProvider } from '../../database/drizzle.provider';
import { departments, tickets } from '../../database/schemas';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { DashboardSlaService } from './dashboard-sla.service';
import { DashboardOverviewService } from './dashboard-overview.service';
import { DashboardResolutionService } from './dashboard-resolution.service';
import { DashboardWorkloadService } from './dashboard-workload.service';

@Injectable()
export class DashboardService {
  private readonly overviewService: DashboardOverviewService;
  private readonly workloadService: DashboardWorkloadService;
  private readonly resolutionService: DashboardResolutionService;

  constructor(
    private readonly drizzle: DrizzleProvider,
    private readonly dashboardSla: DashboardSlaService,
    @Optional() overviewService?: DashboardOverviewService,
    @Optional() workloadService?: DashboardWorkloadService,
    @Optional() resolutionService?: DashboardResolutionService,
  ) {
    this.overviewService = overviewService ?? new DashboardOverviewService(this.drizzle);
    this.workloadService = workloadService ?? new DashboardWorkloadService(this.drizzle);
    this.resolutionService = resolutionService ?? new DashboardResolutionService(this.drizzle);
  }

  private enforceSupervisorScope(departmentId: string | undefined, currentUser?: JwtPayload): string | undefined {
    if (currentUser?.role === 'SUPERVISOR') {
      if (departmentId && departmentId !== currentUser.departmentId) throw new ForbiddenException("Un superviseur ne peut pas accéder aux statistiques d'un autre département.");
      return currentUser.departmentId;
    }
    return departmentId;
  }

  async overview(from?: string, to?: string, currentUser?: JwtPayload) {
    return this.overviewService.overview(from, to, currentUser);
  }

  async ticketsByStatus(from?: string, to?: string, departmentId?: string, currentUser?: JwtPayload) {
    const fromDate = from ? new Date(from) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const toDate = to ? new Date(to) : new Date();
    const targetDeptId = this.enforceSupervisorScope(departmentId, currentUser);
    const conditions = [gte(tickets.createdAt, fromDate), lte(tickets.createdAt, toDate), isNull(tickets.deletedAt)];
    if (targetDeptId) conditions.push(eq(tickets.assignedTeamId, targetDeptId));
    const where = and(...conditions);
    const data = await this.drizzle.db.select({ status: tickets.status, count: count(), avgAgeMinutes: sql<number>`COALESCE(AVG(EXTRACT(EPOCH FROM (NOW() - ${tickets.createdAt})) / 60), 0)` }).from(tickets).where(where).groupBy(tickets.status);
    const total = data.reduce((sum, d) => sum + Number(d.count), 0);
    return { period: { from: fromDate.toISOString(), to: toDate.toISOString() }, data: data.map((d) => ({ ...d, count: Number(d.count), avgAgeMinutes: Math.round(Number(d.avgAgeMinutes)), percentage: total > 0 ? Number(((Number(d.count) / total) * 100).toFixed(2)) : 0 })) };
  }

  async ticketsByPriority(from?: string, to?: string, statusFilter?: string, currentUser?: JwtPayload, departmentId?: string) {
    const fromDate = from ? new Date(from) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const toDate = to ? new Date(to) : new Date();
    const targetDeptId = this.enforceSupervisorScope(departmentId, currentUser);
    const conditions = [gte(tickets.createdAt, fromDate), lte(tickets.createdAt, toDate), isNull(tickets.deletedAt)];
    if (statusFilter === 'OPEN') conditions.push(sql`${tickets.status} NOT IN ('RESOLVED','CLOSED','CANCELLED')`);
    if (statusFilter === 'RESOLVED') conditions.push(sql`${tickets.status} IN ('RESOLVED','CLOSED')`);
    if (targetDeptId) conditions.push(eq(tickets.assignedTeamId, targetDeptId));
    const where = and(...conditions);
    const data = await this.drizzle.db.select({ priority: tickets.priority, count: count(), slaBreaches: sql<number>`COUNT(*) FILTER (WHERE ${tickets.slaBreached} = true)` }).from(tickets).where(where).groupBy(tickets.priority);
    const total = data.reduce((sum, d) => sum + Number(d.count), 0);
    return { period: { from: fromDate.toISOString(), to: toDate.toISOString() }, data: data.map((d) => ({ ...d, count: Number(d.count), slaBreaches: Number(d.slaBreaches), percentage: total > 0 ? Number(((Number(d.count) / total) * 100).toFixed(2)) : 0 })) };
  }

  async departmentsReport(from?: string, to?: string, currentUser?: JwtPayload) {
    const fromDate = from ? new Date(from) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const toDate = to ? new Date(to) : new Date();
    const conditions = [gte(tickets.createdAt, fromDate), lte(tickets.createdAt, toDate), isNull(tickets.deletedAt)];
    const targetDeptId = this.enforceSupervisorScope(undefined, currentUser);
    if (targetDeptId) conditions.push(eq(tickets.assignedTeamId, targetDeptId));
    const where = and(...conditions);
    return {
      period: { from: fromDate.toISOString(), to: toDate.toISOString() },
      data: await this.drizzle.db.select({
          departmentId: tickets.departmentId, departmentName: departments.name, total: count(),
          open: sql<number>`COUNT(*) FILTER (WHERE ${tickets.status} NOT IN ('RESOLVED','CLOSED','CANCELLED'))`,
          resolved: sql<number>`COUNT(*) FILTER (WHERE ${tickets.status} = 'RESOLVED')`,
          closed: sql<number>`COUNT(*) FILTER (WHERE ${tickets.status} = 'CLOSED')`,
          slaCompliant: sql<number>`COUNT(*) FILTER (WHERE ${tickets.slaBreached} = false)`,
          slaBreached: sql<number>`COUNT(*) FILTER (WHERE ${tickets.slaBreached} = true)`,
          avgResolutionMinutes: sql<number>`COALESCE(AVG(EXTRACT(EPOCH FROM (${tickets.resolvedAt} - ${tickets.createdAt})) / 60) FILTER (WHERE ${tickets.resolvedAt} IS NOT NULL), 0)`,
        }).from(tickets).leftJoin(departments, eq(tickets.departmentId, departments.id)).where(where).groupBy(tickets.departmentId, departments.name),
    };
  }

  async slaCompliance(from?: string, to?: string, departmentId?: string, priority?: string, categoryId?: string, currentUser?: JwtPayload) {
    return this.dashboardSla.compliance(from, to, departmentId, priority, categoryId, currentUser);
  }

  async workload(departmentId?: string, currentUser?: JwtPayload) {
    return this.workloadService.workload(departmentId, currentUser);
  }

  async agentPerformance(from?: string, to?: string, currentUser?: JwtPayload) {
    return this.workloadService.agentPerformance(from, to, currentUser);
  }

  async myActivity(currentUser: JwtPayload) {
    return this.workloadService.myActivity(currentUser);
  }

  async resolutionTime(from?: string, to?: string, groupBy?: string, departmentId?: string, priority?: string, currentUser?: JwtPayload) {
    return this.resolutionService.resolutionTime(from, to, groupBy, departmentId, priority, currentUser);
  }
}
