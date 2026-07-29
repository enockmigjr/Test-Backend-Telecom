/**
 * ============================================================================
 * FICHIER : src/modules/tickets/services/ticket-details.service.ts
 * RÔLE : Service d'agrégation avancée des détails d'un ticket d'incident.
 * EXPLICATION :
 * Ce service enrichit la fiche unitaire d'un ticket avec ses métadonnées connexes :
 * 1. `findById` : Récupère les données principales du ticket via `TicketsService`.
 * 2. Exécution parallèle (`Promise.all`) : Compte le nombre de commentaires publics (`ticketComments`) et le nombre de réassignations (`ticketAssignments`).
 * 3. Historique d'assignations : Extrait la liste chronologique paginée des mutations d'assignation subies par le ticket.
 * ============================================================================
 */

import { Injectable } from '@nestjs/common';
import { count, eq, sql } from 'drizzle-orm';
import { normalizePagination } from '../../../common/helpers/normalized-pagination.helper';
import { PaginationHelper } from '../../../common/helpers/pagination.helper';
import { DrizzleProvider } from '../../../database/drizzle.provider';
import { ticketAssignments, ticketComments } from '../../../database/schemas';
import { TicketsService } from './tickets.service';

/**
 * Service d'agrégation d'informations détaillées pour la vue fiche-ticket.
 */
@Injectable()
export class TicketDetailsService {
  constructor(
    private readonly drizzle: DrizzleProvider,
    private readonly ticketsService: TicketsService,
  ) {}

  /**
   * Extrait le détail complet d'un ticket avec son historique d'assignations paginé et le nombre de commentaires.
   *
   * @param id UUID du ticket.
   * @param page Page pour l'historique d'assignation.
   * @param limit Nombre d'éléments par page d'historique.
   */
  async findById(id: string, page = 1, limit = 20) {
    const { data: ticket } = await this.ticketsService.findById(id);
    const pagination = normalizePagination(page, limit);
    const [[commentCount], [assignmentTotal], assignments] = await Promise.all([
      this.drizzle.db.select({ count: count() }).from(ticketComments).where(eq(ticketComments.ticketId, id)),
      this.drizzle.db.select({ count: count() }).from(ticketAssignments).where(eq(ticketAssignments.ticketId, id)),
      this.drizzle.db
        .select({
          id: ticketAssignments.id,
          toUserId: ticketAssignments.toUserId,
          fromUserId: ticketAssignments.fromUserId,
          reason: ticketAssignments.reason,
          createdAt: ticketAssignments.createdAt,
        })
        .from(ticketAssignments)
        .where(eq(ticketAssignments.ticketId, id))
        .orderBy(sql`${ticketAssignments.createdAt} asc`)
        .limit(pagination.limit)
        .offset(PaginationHelper.getOffset(pagination.page, pagination.limit)),
    ]);
    const totalAssignments = Number(assignmentTotal?.count ?? 0);

    return {
      data: {
        ...ticket,
        _meta: {
          commentCount: Number(commentCount?.count ?? 0),
          assignmentCount: totalAssignments,
        },
        assignmentHistory: PaginationHelper.paginate(assignments, totalAssignments, pagination.page, pagination.limit),
      },
    };
  }
}
