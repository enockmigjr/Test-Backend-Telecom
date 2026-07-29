/**
 * ============================================================================
 * FICHIER : src/modules/reports/report-query.service.ts
 * RÔLE : Service de requête et d'extraction de données pour la génération de rapports.
 * EXPLICATION :
 * Ce service extrait et prépare les structures de données brutes avant la génération PDF par BullMQ :
 * 1. `ticketReport` : Récupère la fiche détaillée d'un incident (jointures `departments` et `categories`) en respectant la visibilité ABAC (`ticketVisibilityCondition`).
 * 2. `slaReport` : Calcule les agrégations de conformité SLA (temps moyen de résolution, violations par priorité) pour la période spécifiée.
 * 3. `getReport` & `listReports` : Consulte les métadonnées et l'état des rapports générés (`reports`).
 * ============================================================================
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { and, count, eq, gte, isNull, lte, sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { ticketVisibilityCondition } from '../../common/services/ticket-access.service';
import { DrizzleProvider } from '../../database/drizzle.provider';
import { categories, departments, Report, reports, tickets } from '../../database/schemas';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

/**
 * Service spécialisé dans l'extraction et l'assemblage des données de rapports.
 */
@Injectable()
export class ReportQueryService {
  constructor(private readonly drizzle: DrizzleProvider) {}

  /**
   * Extrait les données complètes d'un ticket individuel pour la construction d'un rapport PDF.
   *
   * @param ticketId Identifiant UUIDv7 du ticket.
   * @param user Utilisateur authentifié pour le filtrage ABAC.
   * @throws NotFoundException si le ticket est introuvable ou invisible pour l'utilisateur.
   */
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

  /**
   * Calcule le rapport d'analyse de conformité SLA pour une période et un département facultatif.
   *
   * @param from Date de début.
   * @param to Date de fin.
   * @param departmentId Identifiant du département (facultatif).
   */
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

  /**
   * Récupère les métadonnées d'un rapport par son identifiant unique.
   *
   * @param id UUID du rapport.
   * @throws NotFoundException si le rapport n'existe pas.
   */
  async getReport(id: string): Promise<Report> {
    const [report] = await this.drizzle.db.select().from(reports).where(eq(reports.id, id)).limit(1);
    if (!report) throw new NotFoundException('Rapport introuvable.');
    return report;
  }

  /**
   * Extrait la liste paginée des rapports générés ou demandés par un utilisateur.
   *
   * @param page Numéro de page.
   * @param limit Limite par page.
   * @param requestedBy UUID de l'utilisateur demandeur (facultatif pour les administrateurs).
   */
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
