import { Injectable, Logger } from '@nestjs/common';
import { DrizzleProvider } from '../../database/drizzle.provider';
import { tickets, departments } from '../../database/schemas';
import { eq, and, gte, lte, isNull, count, sql } from 'drizzle-orm';

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(private readonly drizzle: DrizzleProvider) {}

  /**
   * Génère les données pour un rapport détaillé d'un ticket.
   */
  async ticketReport(ticketId: string) {
    const [ticket] = await this.drizzle.db
      .select({
        id: tickets.id, ticketNumber: tickets.ticketNumber, title: tickets.title,
        description: tickets.description, status: tickets.status, priority: tickets.priority,
        severity: tickets.severity, category: tickets.category, createdAt: tickets.createdAt,
        resolvedAt: tickets.resolvedAt, closedAt: tickets.closedAt,
        customerName: tickets.customerName, resolutionSummary: tickets.resolutionSummary,
        departmentName: departments.name,
      })
      .from(tickets)
      .leftJoin(departments, eq(tickets.departmentId, departments.id))
      .where(and(eq(tickets.id, ticketId), isNull(tickets.deletedAt)))
      .limit(1);

    if (!ticket) throw new Error('Ticket non trouvé');

    return {
      generatedAt: new Date().toISOString(),
      type: 'ticket-report',
      ticket,
    };
  }

  /**
   * Génère les données pour un rapport SLA (tous les tickets d'une période).
   */
  async slaReport(from?: string, to?: string) {
    const fromDate = from ? new Date(from) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const toDate = to ? new Date(to) : new Date();

    const where = and(gte(tickets.createdAt, fromDate), lte(tickets.createdAt, toDate), isNull(tickets.deletedAt));

    const [stats] = await this.drizzle.db
      .select({
        total: count(),
        breached: sql<number>`COUNT(*) FILTER (WHERE ${tickets.slaBreached} = true)`,
        avgResolutionMinutes: sql<number>`COALESCE(AVG(EXTRACT(EPOCH FROM (${tickets.resolvedAt} - ${tickets.createdAt})) / 60) FILTER (WHERE ${tickets.resolvedAt} IS NOT NULL), 0)`,
      })
      .from(tickets).where(where);

    const byPriority = await this.drizzle.db
      .select({ priority: tickets.priority, count: count(), breached: sql<number>`COUNT(*) FILTER (WHERE ${tickets.slaBreached} = true)` })
      .from(tickets).where(where).groupBy(tickets.priority);

    return {
      generatedAt: new Date().toISOString(),
      type: 'sla-report',
      period: { from: fromDate.toISOString(), to: toDate.toISOString() },
      summary: { total: Number(stats?.total || 0), breached: Number(stats?.breached || 0), avgResolutionMinutes: Math.round(Number(stats?.avgResolutionMinutes || 0)) },
      byPriority,
    };
  }
}
