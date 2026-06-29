import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { generateUuid } from '../../common/helpers/uuidv7.helper';
import { DrizzleProvider } from '../../database/drizzle.provider';
import { ticketInternalNotes, users } from '../../database/schemas';
import { PaginationHelper } from '../../common/helpers/pagination.helper';

@Injectable()
export class InternalNotesService {
  private readonly logger = new Logger(InternalNotesService.name);

  constructor(private readonly drizzle: DrizzleProvider) {}

  async findAll(ticketId: string, page = 1, limit = 20) {
    const where = eq(ticketInternalNotes.ticketId, ticketId);
    const offset = PaginationHelper.getOffset(page, limit);

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
      .limit(limit)
      .offset(offset);

    return PaginationHelper.paginate(data, total?.count || 0, page, limit);
  }

  async create(ticketId: string, authorId: string, content: string, role: string) {
    if (role === 'FIELD_TECHNICIAN') {
      throw new ForbiddenException('Les techniciens terrain ne peuvent pas créer de notes internes.');
    }
    const id = generateUuid();
    await this.drizzle.db.insert(ticketInternalNotes).values({ id, ticketId, authorId, content });
    const [created] = await this.drizzle.db
      .select()
      .from(ticketInternalNotes)
      .where(eq(ticketInternalNotes.id, id))
      .limit(1);
    return { message: 'Note interne ajoutée.', data: created };
  }

  async update(id: string, authorId: string, role: string, content: string) {
    if (role === 'FIELD_TECHNICIAN') throw new ForbiddenException('Accès refusé.');
    const note = await this.findOne(id);
    if (note.authorId !== authorId && role !== 'ADMINISTRATOR' && role !== 'SUPERVISOR') {
      throw new ForbiddenException('Vous ne pouvez modifier que vos propres notes.');
    }
    await this.drizzle.db.update(ticketInternalNotes).set({ content }).where(eq(ticketInternalNotes.id, id));
    return { message: 'Note interne mise à jour.' };
  }

  async remove(id: string, authorId: string, role: string) {
    if (role === 'FIELD_TECHNICIAN') throw new ForbiddenException('Accès refusé.');
    const note = await this.findOne(id);
    if (note.authorId !== authorId && role !== 'ADMINISTRATOR' && role !== 'SUPERVISOR') {
      throw new ForbiddenException('Vous ne pouvez supprimer que vos propres notes.');
    }
    await this.drizzle.db.delete(ticketInternalNotes).where(eq(ticketInternalNotes.id, id));
  }

  private async findOne(id: string) {
    const [note] = await this.drizzle.db
      .select()
      .from(ticketInternalNotes)
      .where(eq(ticketInternalNotes.id, id))
      .limit(1);
    if (!note) throw new NotFoundException('Note interne non trouvée.');
    return note;
  }
}
