import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { normalizePagination } from '../../common/helpers/normalized-pagination.helper';
import { PaginationHelper } from '../../common/helpers/pagination.helper';
import { generateUuid } from '../../common/helpers/uuidv7.helper';
import { TicketAccessService } from '../../common/services/ticket-access.service';
import { DrizzleProvider } from '../../database/drizzle.provider';
import { ticketComments, users } from '../../database/schemas';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

@Injectable()
export class CommentsService {
  private readonly logger = new Logger(CommentsService.name);

  constructor(
    private readonly drizzle: DrizzleProvider,
    private readonly ticketAccess: TicketAccessService,
  ) {}

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

  async create(ticketId: string, user: JwtPayload, content: string) {
    await this.ticketAccess.assertTicketVisible(ticketId, user);
    const id = generateUuid();
    await this.drizzle.db.insert(ticketComments).values({ id, ticketId, authorId: user.sub, content });
    const [created] = await this.drizzle.db.select().from(ticketComments).where(eq(ticketComments.id, id)).limit(1);
    return { message: 'Commentaire ajoute avec succes.', data: created };
  }

  async update(id: string, user: JwtPayload, content: string) {
    const comment = await this.findOne(id);
    await this.ticketAccess.assertTicketVisible(comment.ticketId, user);
    this.assertCanModify(comment.authorId, user, 'modifier');
    await this.drizzle.db.update(ticketComments).set({ content }).where(eq(ticketComments.id, id));
    const [updated] = await this.drizzle.db.select().from(ticketComments).where(eq(ticketComments.id, id)).limit(1);
    return { message: 'Commentaire mis a jour.', data: updated };
  }

  async remove(id: string, user: JwtPayload) {
    const comment = await this.findOne(id);
    await this.ticketAccess.assertTicketVisible(comment.ticketId, user);
    this.assertCanModify(comment.authorId, user, 'supprimer');
    await this.drizzle.db.delete(ticketComments).where(eq(ticketComments.id, id));
  }

  private async findOne(id: string) {
    const [comment] = await this.drizzle.db.select().from(ticketComments).where(eq(ticketComments.id, id)).limit(1);
    if (!comment) throw new NotFoundException('Commentaire non trouve.');
    return comment;
  }

  private assertCanModify(authorId: string, user: JwtPayload, action: 'modifier' | 'supprimer'): void {
    if (authorId === user.sub || user.role === 'ADMINISTRATOR' || user.role === 'SUPERVISOR') return;
    throw new ForbiddenException(`Vous ne pouvez ${action} que vos propres commentaires.`);
  }
}
