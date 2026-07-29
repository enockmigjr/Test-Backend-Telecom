/**
 * ============================================================================
 * FICHIER : src/modules/comments/comments.service.ts
 * RÔLE : Service de gestion métier des commentaires publics rattachés aux tickets d'incidents.
 * EXPLICATION :
 * Ce service gère les interactions publiques sur les tickets :
 * 1. `findAll` : Extrait la liste paginée et chronologique des commentaires d'un ticket en joignant les informations de l'auteur (`firstName`, `lastName`, `role`).
 * 2. `create` : Enregistre un nouveau commentaire public en générant un identifiant UUIDv7.
 * 3. `update` & `remove` : Permet la modification ou la suppression d'un commentaire en vérifiant (`assertCanModify`) que l'utilisateur est l'auteur initial, un `SUPERVISOR` ou un `ADMINISTRATOR`.
 * 4. Contrôle systématique de la visibilité du ticket hôte via `TicketAccessService.assertTicketVisible`.
 * ============================================================================
 */

import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { normalizePagination } from '../../common/helpers/normalized-pagination.helper';
import { PaginationHelper } from '../../common/helpers/pagination.helper';
import { generateUuid } from '../../common/helpers/uuidv7.helper';
import { TicketAccessService } from '../../common/services/ticket-access.service';
import { DrizzleProvider } from '../../database/drizzle.provider';
import { ticketComments, users } from '../../database/schemas';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

/**
 * Service orchestrant la persistance et la gestion des droits sur les commentaires publics.
 */
@Injectable()
export class CommentsService {
  private readonly logger = new Logger(CommentsService.name);

  constructor(
    private readonly drizzle: DrizzleProvider,
    private readonly ticketAccess: TicketAccessService,
  ) {}

  /**
   * Extrait la liste paginée des commentaires publics enregistrés sur un ticket.
   *
   * @param ticketId Identifiant UUIDv7 du ticket hôte.
   * @param user Utilisateur authentifié demandeur.
   * @param page Numéro de la page (par défaut 1).
   * @param limit Nombre de commentaires par page (par défaut 20).
   */
  async findAll(ticketId: string, user: JwtPayload, page = 1, limit = 20) {
    await this.ticketAccess.assertTicketVisible(ticketId, user);
    const pagination = normalizePagination(page, limit);
    const where = eq(ticketComments.ticketId, ticketId);
    const offset = PaginationHelper.getOffset(pagination.page, pagination.limit);
    const [total] = await this.drizzle.db
      .select({ count: sql<number>`count(*)` })
      .from(ticketComments)
      .where(where);

    const data = await this.drizzle.db
      .select({
        id: ticketComments.id,
        ticketId: ticketComments.ticketId,
        authorId: ticketComments.authorId,
        content: ticketComments.content,
        createdAt: ticketComments.createdAt,
        updatedAt: ticketComments.updatedAt,
        authorFirstName: users.firstName,
        authorLastName: users.lastName,
        authorRole: users.role,
      })
      .from(ticketComments)
      .leftJoin(users, eq(ticketComments.authorId, users.id))
      .where(where)
      .orderBy(ticketComments.createdAt)
      .limit(pagination.limit)
      .offset(offset);

    return PaginationHelper.paginate(data, Number(total?.count ?? 0), pagination.page, pagination.limit);
  }

  /**
   * Crée un nouveau commentaire public sur le ticket spécifié.
   *
   * @param ticketId UUID du ticket hôte.
   * @param user Utilisateur auteur du commentaire.
   * @param content Texte du commentaire.
   */
  async create(ticketId: string, user: JwtPayload, content: string) {
    await this.ticketAccess.assertTicketVisible(ticketId, user);
    const id = generateUuid();
    await this.drizzle.db.insert(ticketComments).values({ id, ticketId, authorId: user.sub, content });
    const [created] = await this.drizzle.db.select().from(ticketComments).where(eq(ticketComments.id, id)).limit(1);
    return { message: 'Commentaire ajouté avec succès.', data: created };
  }

  /**
   * Met à jour le contenu d'un commentaire public.
   *
   * @param id UUID du commentaire à modifier.
   * @param user Utilisateur émetteur de la modification.
   * @param content Nouveau texte du commentaire.
   */
  async update(id: string, user: JwtPayload, content: string) {
    const comment = await this.findOne(id);
    await this.ticketAccess.assertTicketVisible(comment.ticketId, user);
    this.assertCanModify(comment.authorId, user, 'modifier');
    await this.drizzle.db.update(ticketComments).set({ content }).where(eq(ticketComments.id, id));
    const [updated] = await this.drizzle.db.select().from(ticketComments).where(eq(ticketComments.id, id)).limit(1);
    return { message: 'Commentaire mis à jour.', data: updated };
  }

  /**
   * Supprime un commentaire public.
   *
   * @param id UUID du commentaire à supprimer.
   * @param user Utilisateur demandeur de la suppression.
   */
  async remove(id: string, user: JwtPayload) {
    const comment = await this.findOne(id);
    await this.ticketAccess.assertTicketVisible(comment.ticketId, user);
    this.assertCanModify(comment.authorId, user, 'supprimer');
    await this.drizzle.db.delete(ticketComments).where(eq(ticketComments.id, id));
  }

  /**
   * Recherche un commentaire public par son identifiant.
   */
  private async findOne(id: string) {
    const [comment] = await this.drizzle.db.select().from(ticketComments).where(eq(ticketComments.id, id)).limit(1);
    if (!comment) throw new NotFoundException('Commentaire non trouvé.');
    return comment;
  }

  /**
   * Vérifie que l'utilisateur possède les droits requis pour modifier ou supprimer un commentaire.
   * Autorisé pour l'auteur d'origine, un superviseur ou un administrateur.
   */
  private assertCanModify(authorId: string, user: JwtPayload, action: 'modifier' | 'supprimer'): void {
    if (authorId === user.sub || user.role === 'ADMINISTRATOR' || user.role === 'SUPERVISOR') return;
    throw new ForbiddenException(`Vous ne pouvez ${action} que vos propres commentaires.`);
  }
}
