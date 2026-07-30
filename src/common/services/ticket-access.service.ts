/**
 * ============================================================================
 * FICHIER : src/common/services/ticket-access.service.ts
 * RÔLE : Service d'évaluation des accès et de la visibilité des tickets d'incidents (ABAC/RBAC).
 * EXPLICATION :
 * Ce service contrôle les permissions de consultation et d'association de ressources :
 * 1. `ticketVisibilityCondition` : Construit l'expression SQL d'isolation par département et par rôle (ADMINISTRATOR a un accès global ; les autres rôles accèdent aux tickets de leur département, de leur équipe, créés par eux ou qui leur sont assignés).
 * 2. `assertTicketVisible` : Vérifie l'existence et l'accès à un ticket en distinguant une ressource inexistante (404) d'un accès interdit (403).
 * 3. `resolveVisibleParent` : Valide l'association unique d'une pièce jointe à une entité parente (`ticketId`, `commentId`, ou `internalNoteId`) et interdit l'accès aux notes internes aux techniciens de terrain (`FIELD_TECHNICIAN`).
 * ============================================================================
 */

import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq, isNull, or, SQL } from 'drizzle-orm';
import { DrizzleProvider } from '../../database/drizzle.provider';
import { ticketComments, ticketInternalNotes, tickets } from '../../database/schemas';
import { JwtPayload } from '../../modules/auth/interfaces/jwt-payload.interface';

/** Structure décrivant les 3 cibles possibles de rattachement d'une pièce jointe. */
export interface AttachmentAssociation {
  ticketId?: string | null;
  commentId?: string | null;
  internalNoteId?: string | null;
}

/**
 * Génère la clause de visibilité Drizzle SQL selon le rôle et le département de l'utilisateur authentifié.
 *
 * @param user Le payload du jeton JWT de l'utilisateur.
 * @returns La condition SQL OR ou `undefined` si l'utilisateur est administrateur système.
 */
export function ticketVisibilityCondition(user: JwtPayload): SQL<unknown> | undefined {
  if (user.role === 'ADMINISTRATOR') return undefined;

  return or(
    eq(tickets.departmentId, user.departmentId),
    eq(tickets.assignedTeamId, user.departmentId),
    eq(tickets.assignedTo, user.sub),
    eq(tickets.createdBy, user.sub),
    eq(tickets.openedByUserId, user.sub),
  ) as SQL<unknown>;
}

/**
 * Service vérifiant les droits d'accès aux tickets et résolvant les entités parentes des pièces jointes.
 */
@Injectable()
export class TicketAccessService {
  constructor(private readonly drizzle: DrizzleProvider) {}

  /**
   * Valide que l'utilisateur a le droit d'accéder au ticket spécifié.
   *
   * @param ticketId Identifiant UUIDv7 du ticket.
   * @param user Utilisateur authentifié.
   * @throws NotFoundException si le ticket n'existe pas ou est supprimé.
   * @throws ForbiddenException si le ticket existe mais n'est pas visible par l'utilisateur.
   */
  async assertTicketVisible(ticketId: string, user: JwtPayload): Promise<void> {
    const visibility = ticketVisibilityCondition(user);
    const [ticket] = await this.drizzle.db
      .select({ id: tickets.id })
      .from(tickets)
      .where(and(eq(tickets.id, ticketId), isNull(tickets.deletedAt), visibility))
      .limit(1);

    if (ticket) return;

    // Distinguer 404 (inexistant) de 403 (accès refusé par isolation départementale)
    const [existing] = await this.drizzle.db
      .select({ id: tickets.id })
      .from(tickets)
      .where(and(eq(tickets.id, ticketId), isNull(tickets.deletedAt)))
      .limit(1);

    if (!existing) throw new NotFoundException('Ticket non trouvé ou supprimé.');
    throw new ForbiddenException("Vous n'avez pas accès à ce ticket.");
  }

  /**
   * Vérifie qu'une pièce jointe est associée à exactement un parent et valide la visibilité de ce parent.
   *
   * @param association Cibles de rattachement fournies (ticketId, commentId, internalNoteId).
   * @param user Utilisateur authentifié.
   * @returns L'identifiant UUID du ticket hôte final.
   * @throws BadRequestException si plusieurs ou aucun parent n'est spécifié.
   * @throws ForbiddenException si le rôle est FIELD_TECHNICIAN et cible une note interne.
   */
  async resolveVisibleParent(association: AttachmentAssociation, user: JwtPayload): Promise<string> {
    const associations = [association.ticketId, association.commentId, association.internalNoteId].filter(
      (value): value is string => typeof value === 'string' && value.length > 0,
    );

    if (associations.length !== 1) {
      throw new BadRequestException('Une pièce jointe doit être associée à exactement une ressource parente.');
    }

    // Cas 1 : Rattachement direct à un ticket
    if (association.ticketId) {
      await this.assertTicketVisible(association.ticketId, user);
      return association.ticketId;
    }

    // Cas 2 : Rattachement à un commentaire public
    if (association.commentId) {
      const [comment] = await this.drizzle.db
        .select({ ticketId: ticketComments.ticketId })
        .from(ticketComments)
        .where(eq(ticketComments.id, association.commentId))
        .limit(1);
      if (!comment) throw new NotFoundException('Commentaire non trouvé.');
      await this.assertTicketVisible(comment.ticketId, user);
      return comment.ticketId;
    }

    // Cas 3 : Rattachement à une note interne confidentielle
    if (user.role === 'FIELD_TECHNICIAN') {
      throw new ForbiddenException("Les techniciens terrain n'ont pas accès aux notes internes.");
    }
    const [note] = await this.drizzle.db
      .select({ ticketId: ticketInternalNotes.ticketId })
      .from(ticketInternalNotes)
      .where(eq(ticketInternalNotes.id, association.internalNoteId as string))
      .limit(1);
    if (!note) throw new NotFoundException('Note interne non trouvée.');
    await this.assertTicketVisible(note.ticketId, user);
    return note.ticketId;
  }
}
