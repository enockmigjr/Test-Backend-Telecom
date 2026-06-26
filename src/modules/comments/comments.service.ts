import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { DrizzleProvider } from '../../database/drizzle.provider';
import { ticketComments } from '../../database/schemas';
import { PaginationHelper } from '../../common/helpers/pagination.helper';

@Injectable()
export class CommentsService {
  private readonly logger = new Logger(CommentsService.name);

  constructor(private readonly drizzle: DrizzleProvider) {}

  async findAll(ticketId: string, page = 1, limit = 20) {
    const where = eq(ticketComments.ticketId, ticketId);
    const offset = PaginationHelper.getOffset(page, limit);

    const [total] = await this.drizzle.db
      .select({ count: sql<number>`count(*)` })
      .from(ticketComments)
      .where(where);

    const data = await this.drizzle.db
      .select()
      .from(ticketComments)
      .where(where)
      .orderBy(ticketComments.createdAt)
      .limit(limit)
      .offset(offset);

    return PaginationHelper.paginate(data, total?.count || 0, page, limit);
  }

  async create(ticketId: string, authorId: string, content: string) {
    const id = uuidv4();
    await this.drizzle.db.insert(ticketComments).values({ id, ticketId, authorId, content });
    const [created] = await this.drizzle.db.select().from(ticketComments).where(eq(ticketComments.id, id)).limit(1);
    return { message: 'Commentaire ajouté avec succès.', data: created };
  }

  async update(id: string, authorId: string, role: string, content: string) {
    const comment = await this.findOne(id);
    if (comment.authorId !== authorId && role !== 'ADMINISTRATOR' && role !== 'SUPERVISOR') {
      throw new ForbiddenException('Vous ne pouvez modifier que vos propres commentaires.');
    }
    await this.drizzle.db.update(ticketComments).set({ content }).where(eq(ticketComments.id, id));
    const [updated] = await this.drizzle.db.select().from(ticketComments).where(eq(ticketComments.id, id)).limit(1);
    return { message: 'Commentaire mis à jour.', data: updated };
  }

  async remove(id: string, authorId: string, role: string) {
    const comment = await this.findOne(id);
    if (comment.authorId !== authorId && role !== 'ADMINISTRATOR' && role !== 'SUPERVISOR') {
      throw new ForbiddenException('Vous ne pouvez supprimer que vos propres commentaires.');
    }
    await this.drizzle.db.delete(ticketComments).where(eq(ticketComments.id, id));
  }

  private async findOne(id: string) {
    const [comment] = await this.drizzle.db.select().from(ticketComments).where(eq(ticketComments.id, id)).limit(1);
    if (!comment) throw new NotFoundException('Commentaire non trouvé.');
    return comment;
  }
}
