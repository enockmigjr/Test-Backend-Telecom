import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq, isNull, or, SQL } from 'drizzle-orm';
import { DrizzleProvider } from '../../database/drizzle.provider';
import { ticketComments, ticketInternalNotes, tickets } from '../../database/schemas';
import { JwtPayload } from '../../modules/auth/interfaces/jwt-payload.interface';

export interface AttachmentAssociation {
  ticketId?: string | null;
  commentId?: string | null;
  internalNoteId?: string | null;
}

export function ticketVisibilityCondition(user: JwtPayload): SQL<unknown> | undefined {
  if (user.role === 'ADMINISTRATOR') return undefined;

  return or(
    eq(tickets.departmentId, user.departmentId),
    eq(tickets.assignedTeamId, user.departmentId),
    eq(tickets.assignedTo, user.sub),
    eq(tickets.createdBy, user.sub),
  ) as SQL<unknown>;
}

@Injectable()
export class TicketAccessService {
  constructor(private readonly drizzle: DrizzleProvider) {}

  async assertTicketVisible(ticketId: string, user: JwtPayload): Promise<void> {
    const visibility = ticketVisibilityCondition(user);
    const [ticket] = await this.drizzle.db
      .select({ id: tickets.id })
      .from(tickets)
      .where(and(eq(tickets.id, ticketId), isNull(tickets.deletedAt), visibility))
      .limit(1);

    if (ticket) return;

    const [existing] = await this.drizzle.db
      .select({ id: tickets.id })
      .from(tickets)
      .where(and(eq(tickets.id, ticketId), isNull(tickets.deletedAt)))
      .limit(1);

    if (!existing) throw new NotFoundException('Ticket non trouve ou supprime.');
    throw new ForbiddenException("Vous n'avez pas acces a ce ticket.");
  }

  async resolveVisibleParent(association: AttachmentAssociation, user: JwtPayload): Promise<string> {
    const associations = [association.ticketId, association.commentId, association.internalNoteId].filter(
      (value): value is string => typeof value === 'string' && value.length > 0,
    );
    if (associations.length !== 1) {
      throw new BadRequestException('Une piece jointe doit etre associee a exactement une ressource parente.');
    }

    if (association.ticketId) {
      await this.assertTicketVisible(association.ticketId, user);
      return association.ticketId;
    }
    if (association.commentId) {
      const [comment] = await this.drizzle.db
        .select({ ticketId: ticketComments.ticketId })
        .from(ticketComments)
        .where(eq(ticketComments.id, association.commentId))
        .limit(1);
      if (!comment) throw new NotFoundException('Commentaire non trouve.');
      await this.assertTicketVisible(comment.ticketId, user);
      return comment.ticketId;
    }

    if (user.role === 'FIELD_TECHNICIAN') {
      throw new ForbiddenException("Les techniciens terrain n'ont pas acces aux notes internes.");
    }
    const [note] = await this.drizzle.db
      .select({ ticketId: ticketInternalNotes.ticketId })
      .from(ticketInternalNotes)
      .where(eq(ticketInternalNotes.id, association.internalNoteId as string))
      .limit(1);
    if (!note) throw new NotFoundException('Note interne non trouvee.');
    await this.assertTicketVisible(note.ticketId, user);
    return note.ticketId;
  }
}
