/**
 * ============================================================================
 * FICHIER : src/modules/tickets/services/tickets-search.service.ts
 * RÔLE : Service de recherche multicritère, filtrage et tri paginé des tickets d'incidents.
 * EXPLICATION :
 * Ce service offre un moteur de recherche puissant sur le catalogue des tickets :
 * 1. Isolation RBAC/ABAC : Applique `ticketVisibilityCondition(user)` pour restreindre le périmètre de recherche au rôle et département de l'utilisateur.
 * 2. Filtrage multicritère : Statut, priorité, sévérité, catégorie, agent assigné, équipe, dates de création (`from`/`to`).
 * 3. Recherche textuelle floue (`ILIKE`) : Balaye le titre, la description, la référence `ticketNumber`, le nom du client et son numéro de compte.
 * 4. Tri dynamique et pagination standardisée.
 * ============================================================================
 */

import { Injectable } from '@nestjs/common';
import { and, asc, desc, eq, gte, ilike, isNull, lte, or, sql, SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { normalizePagination } from '../../../common/helpers/normalized-pagination.helper';
import { PaginationHelper } from '../../../common/helpers/pagination.helper';
import { ticketVisibilityCondition } from '../../../common/services/ticket-access.service';
import { DrizzleProvider } from '../../../database/drizzle.provider';
import { categories, departments, tickets, users } from '../../../database/schemas';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';

/** Interface décrivant tous les filtres applicables à la recherche de tickets. */
export interface TicketSearchFilters {
  status?: string;
  priority?: string;
  severity?: string;
  categoryId?: string;
  assignedTo?: string;
  assignedTeam?: string;
  departmentId?: string;
  createdBy?: string;
  search?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
  sort?: 'createdAt' | 'updatedAt' | 'priority' | 'severity' | 'status' | 'ticketNumber';
  order?: 'asc' | 'desc';
}

const assignedTeam = alias(departments, 'search_assigned_team');
const assignee = alias(users, 'search_assignee');

/**
 * Service gérant les requêtes complexes de recherche et de filtrage de tickets.
 */
@Injectable()
export class TicketsSearchService {
  constructor(private readonly drizzle: DrizzleProvider) {}

  /**
   * Exécute une recherche paginée de tickets filtrée selon le périmètre de l'utilisateur connecté.
   *
   * @param filters Ensemble des critères de recherche et paramètres de tri/pagination.
   * @param user Payload JWT de l'utilisateur demandeur (pour le filtrage ABAC/RBAC).
   */
  async search(filters: TicketSearchFilters, user: JwtPayload) {
    const pagination = normalizePagination(filters.page, filters.limit);
    const conditions: SQL<unknown>[] = [isNull(tickets.deletedAt)];
    const visibility = ticketVisibilityCondition(user);
    if (visibility) conditions.push(visibility);
    this.addFilters(conditions, filters);
    const where = and(...conditions);
    const [total] = await this.drizzle.db
      .select({ count: sql<number>`count(*)` })
      .from(tickets)
      .where(where);

    const sortColumns = {
      createdAt: tickets.createdAt,
      updatedAt: tickets.updatedAt,
      priority: tickets.priority,
      severity: tickets.severity,
      status: tickets.status,
      ticketNumber: tickets.ticketNumber,
    } as const;
    const sortColumn = sortColumns[filters.sort ?? 'createdAt'];
    const data = await this.drizzle.db
      .select({
        id: tickets.id,
        ticketNumber: tickets.ticketNumber,
        title: tickets.title,
        status: tickets.status,
        priority: tickets.priority,
        severity: tickets.severity,
        categoryId: tickets.categoryId,
        categoryName: categories.name,
        assignedTo: tickets.assignedTo,
        assignedTeamId: tickets.assignedTeamId,
        departmentId: tickets.departmentId,
        assigneeName: sql<string>`concat(${assignee.firstName}, ' ', ${assignee.lastName})`,
        departmentName: departments.name,
        assignedTeamName: assignedTeam.name,
        customerName: tickets.customerName,
        requesterId: tickets.requesterId,
        supportIntegrationId: tickets.supportIntegrationId,
        sourceChannel: tickets.sourceChannel,
        resolutionDueAt: tickets.resolutionDueAt,
        slaBreached: tickets.slaBreached,
        createdAt: tickets.createdAt,
        updatedAt: tickets.updatedAt,
      })
      .from(tickets)
      .leftJoin(categories, eq(tickets.categoryId, categories.id))
      .leftJoin(departments, eq(tickets.departmentId, departments.id))
      .leftJoin(assignedTeam, eq(tickets.assignedTeamId, assignedTeam.id))
      .leftJoin(assignee, eq(tickets.assignedTo, assignee.id))
      .where(where)
      .orderBy(filters.order === 'asc' ? asc(sortColumn) : desc(sortColumn))
      .limit(pagination.limit)
      .offset(PaginationHelper.getOffset(pagination.page, pagination.limit));
    return PaginationHelper.paginate(data, Number(total?.count ?? 0), pagination.page, pagination.limit);
  }

  /**
   * Construit dynamiquement le tableau de clauses SQL WHERE à partir des filtres reçus.
   */
  private addFilters(conditions: SQL<unknown>[], filters: TicketSearchFilters): void {
    if (filters.status) conditions.push(eq(tickets.status, filters.status as typeof tickets.$inferSelect.status));
    if (filters.priority) {
      conditions.push(eq(tickets.priority, filters.priority as typeof tickets.$inferSelect.priority));
    }
    if (filters.severity) {
      conditions.push(eq(tickets.severity, filters.severity as typeof tickets.$inferSelect.severity));
    }
    if (filters.categoryId) conditions.push(eq(tickets.categoryId, filters.categoryId));
    if (filters.assignedTo) conditions.push(eq(tickets.assignedTo, filters.assignedTo));
    if (filters.assignedTeam) conditions.push(eq(tickets.assignedTeamId, filters.assignedTeam));
    if (filters.departmentId) conditions.push(eq(tickets.departmentId, filters.departmentId));
    if (filters.createdBy) {
      conditions.push(
        or(eq(tickets.createdBy, filters.createdBy), eq(tickets.openedByUserId, filters.createdBy)) as SQL<unknown>,
      );
    }
    if (filters.from) conditions.push(gte(tickets.createdAt, new Date(filters.from)));
    if (filters.to) conditions.push(lte(tickets.createdAt, new Date(filters.to)));
    if (filters.search) {
      const term = `%${filters.search}%`;
      conditions.push(
        or(
          ilike(tickets.title, term),
          ilike(tickets.description, term),
          ilike(tickets.ticketNumber, term),
          ilike(tickets.customerName, term),
          ilike(tickets.customerAccountNumber, term),
          ilike(tickets.customerContact, term),
        ) as SQL<unknown>,
      );
    }
  }
}
