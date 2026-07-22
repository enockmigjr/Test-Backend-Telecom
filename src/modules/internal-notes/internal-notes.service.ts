import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { normalizePagination } from '../../common/helpers/normalized-pagination.helper';
import { PaginationHelper } from '../../common/helpers/pagination.helper';
import { generateUuid } from '../../common/helpers/uuidv7.helper';
import { TicketAccessService } from '../../common/services/ticket-access.service';
import { DrizzleProvider } from '../../database/drizzle.provider';
import { ticketInternalNotes, users } from '../../database/schemas';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

@Injectable()
export class InternalNotesService {
  private readonly logger = new Logger(InternalNotesService.name);

  constructor(
    private readonly drizzle: DrizzleProvider,
    private readonly ticketAccess: TicketAccessService,
  ) {}

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
    return { message: 'Note interne ajoutee.', data: created };
  }

  async update(id: string, user: JwtPayload, content: string) {
    this.assertRole(user);
    const note = await this.findOne(id);
    await this.ticketAccess.assertTicketVisible(note.ticketId, user);
    this.assertCanModify(note.authorId, user, 'modifier');
    await this.drizzle.db.update(ticketInternalNotes).set({ content }).where(eq(ticketInternalNotes.id, id));
    return { message: 'Note interne mise a jour.' };
  }

  async remove(id: string, user: JwtPayload) {
    this.assertRole(user);
    const note = await this.findOne(id);
    await this.ticketAccess.assertTicketVisible(note.ticketId, user);
    this.assertCanModify(note.authorId, user, 'supprimer');
    await this.drizzle.db.delete(ticketInternalNotes).where(eq(ticketInternalNotes.id, id));
  }

  private async findOne(id: string) {
    const [note] = await this.drizzle.db
      .select()
      .from(ticketInternalNotes)
      .where(eq(ticketInternalNotes.id, id))
      .limit(1);
    if (!note) throw new NotFoundException('Note interne non trouvee.');
    return note;
  }

  private assertRole(user: JwtPayload): void {
    if (user.role === 'FIELD_TECHNICIAN') throw new ForbiddenException('Acces refuse.');
  }

  private assertCanModify(authorId: string, user: JwtPayload, action: 'modifier' | 'supprimer'): void {
    if (authorId === user.sub || user.role === 'ADMINISTRATOR' || user.role === 'SUPERVISOR') return;
    throw new ForbiddenException(`Vous ne pouvez ${action} que vos propres notes.`);
  }
}
