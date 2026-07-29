/**
 * ============================================================================
 * FICHIER : src/modules/internal-notes/internal-notes.service.ts
 * RÔLE : Service de gestion métier des notes internes confidentielles d'incidents.
 * EXPLICATION :
 * Ce service orchestre la communication interne entre agents et ingénieurs :
 * 1. `assertRole` : Interdit formellement l'accès et la manipulation des notes internes aux techniciens terrain (`FIELD_TECHNICIAN`).
 * 2. `findAll` : Liste paginée des notes d'un ticket avec concaténation SQL du nom complet de l'auteur (`concat(firstName, ' ', lastName)`).
 * 3. `create`, `update`, `remove` : Contrôle les droits d'édition via `assertCanModify` (auteur, `SUPERVISOR`, `ADMINISTRATOR`) et vérifie la visibilité du ticket hôte.
 * ============================================================================
 */

import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { normalizePagination } from '../../common/helpers/normalized-pagination.helper';
import { PaginationHelper } from '../../common/helpers/pagination.helper';
import { generateUuid } from '../../common/helpers/uuidv7.helper';
import { TicketAccessService } from '../../common/services/ticket-access.service';
import { DrizzleProvider } from '../../database/drizzle.provider';
import { ticketInternalNotes, users } from '../../database/schemas';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

/**
 * Service gérant la création, la lecture et l'édition des notes internes réservées.
 */
@Injectable()
export class InternalNotesService {
  private readonly logger = new Logger(InternalNotesService.name);

  constructor(
    private readonly drizzle: DrizzleProvider,
    private readonly ticketAccess: TicketAccessService,
  ) {}

  /**
   * Extrait la liste paginée des notes internes d'un ticket.
   *
   * @param ticketId Identifiant UUIDv7 du ticket.
   * @param user Utilisateur authentifié demandeur.
   * @param page Numéro de la page (par défaut 1).
   * @param limit Nombre de notes par page (par défaut 20).
   */
  async findAll(ticketId: string, user: JwtPayload, page = 1, limit = 20) {
    this.assertRole(user);
    await this.ticketAccess.assertTicketVisible(ticketId, user);
    const pagination = normalizePagination(page, limit);
    const where = eq(ticketInternalNotes.ticketId, ticketId);
    const offset = PaginationHelper.getOffset(pagination.page, pagination.limit);
    const [total] = await this.drizzle.db
      .select({ count: sql<number>`count(*)` })
      .from(ticketInternalNotes)
      .where(where);

    const data = await this.drizzle.db
      .select({
        id: ticketInternalNotes.id,
        ticketId: ticketInternalNotes.ticketId,
        authorId: ticketInternalNotes.authorId,
        content: ticketInternalNotes.content,
        createdAt: ticketInternalNotes.createdAt,
        authorName: sql<string>`concat(${users.firstName}, ' ', ${users.lastName})`,
      })
      .from(ticketInternalNotes)
      .leftJoin(users, eq(ticketInternalNotes.authorId, users.id))
      .where(where)
      .orderBy(ticketInternalNotes.createdAt)
      .limit(pagination.limit)
      .offset(offset);

    return PaginationHelper.paginate(data, Number(total?.count ?? 0), pagination.page, pagination.limit);
  }

  /**
   * Ajoute une nouvelle note interne sur un ticket.
   *
   * @param ticketId UUID du ticket hôte.
   * @param user Auteur de la note.
   * @param content Texte confidentiel de la note.
   */
  async create(ticketId: string, user: JwtPayload, content: string) {
    this.assertRole(user);
    await this.ticketAccess.assertTicketVisible(ticketId, user);
    const id = generateUuid();
    await this.drizzle.db.insert(ticketInternalNotes).values({ id, ticketId, authorId: user.sub, content });
    const [created] = await this.drizzle.db
      .select()
      .from(ticketInternalNotes)
      .where(eq(ticketInternalNotes.id, id))
      .limit(1);
    return { message: 'Note interne ajoutée.', data: created };
  }

  /**
   * Met à jour le texte d'une note interne.
   *
   * @param id UUID de la note à modifier.
   * @param user Utilisateur émetteur.
   * @param content Nouveau contenu textuel.
   */
  async update(id: string, user: JwtPayload, content: string) {
    this.assertRole(user);
    const note = await this.findOne(id);
    await this.ticketAccess.assertTicketVisible(note.ticketId, user);
    this.assertCanModify(note.authorId, user, 'modifier');
    await this.drizzle.db.update(ticketInternalNotes).set({ content }).where(eq(ticketInternalNotes.id, id));
    const [updated] = await this.drizzle.db
      .select()
      .from(ticketInternalNotes)
      .where(eq(ticketInternalNotes.id, id))
      .limit(1);
    return { message: 'Note interne mise à jour.', data: updated };
  }

  /**
   * Supprime une note interne.
   *
   * @param id UUID de la note à supprimer.
   * @param user Utilisateur demandeur.
   */
  async remove(id: string, user: JwtPayload) {
    this.assertRole(user);
    const note = await this.findOne(id);
    await this.ticketAccess.assertTicketVisible(note.ticketId, user);
    this.assertCanModify(note.authorId, user, 'supprimer');
    await this.drizzle.db.delete(ticketInternalNotes).where(eq(ticketInternalNotes.id, id));
  }

  /**
   * Recherche une note interne par son identifiant unique.
   */
  private async findOne(id: string) {
    const [note] = await this.drizzle.db
      .select()
      .from(ticketInternalNotes)
      .where(eq(ticketInternalNotes.id, id))
      .limit(1);
    if (!note) throw new NotFoundException('Note interne non trouvée.');
    return note;
  }

  /**
   * Vérifie que l'utilisateur n'est pas un technicien terrain (`FIELD_TECHNICIAN`).
   */
  private assertRole(user: JwtPayload): void {
    if (user.role === 'FIELD_TECHNICIAN') throw new ForbiddenException('Accès refusé.');
  }

  /**
   * Contrôle les permissions de modification ou suppression de la note interne.
   */
  private assertCanModify(authorId: string, user: JwtPayload, action: 'modifier' | 'supprimer'): void {
    if (authorId === user.sub || user.role === 'ADMINISTRATOR' || user.role === 'SUPERVISOR') return;
    throw new ForbiddenException(`Vous ne pouvez ${action} que vos propres notes.`);
  }
}
