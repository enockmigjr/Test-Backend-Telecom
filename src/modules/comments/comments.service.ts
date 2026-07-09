import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { generateUuid } from '../../common/helpers/uuidv7.helper';
import { DrizzleProvider } from '../../database/drizzle.provider';
import { ticketComments, tickets } from '../../database/schemas';
import { PaginationHelper } from '../../common/helpers/pagination.helper';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

@Injectable()
export class CommentsService {
  private readonly logger = new Logger(CommentsService.name);

  constructor(private readonly drizzle: DrizzleProvider) {}

  async findAll(ticketId: string, page = 1, limit = 20) {
    const pageNum = Number(page ?? 1);
    const limitNum = Number(limit ?? 20);
    const where = eq(ticketComments.ticketId, ticketId);
    const offset = PaginationHelper.getOffset(pageNum, limitNum);

    const [total] = await this.drizzle.db
      .select({ count: sql<number>`count(*)` })
      .from(ticketComments)
      .where(where);

    const data = await this.drizzle.db
      .select()
      .from(ticketComments)
      .where(where)
      .orderBy(ticketComments.createdAt)
      .limit(limitNum)
      .offset(offset);

    return PaginationHelper.paginate(data, Number(total?.count ?? 0), pageNum, limitNum);
  }

  async create(ticketId: string, authorId: string, content: string) {
    const id = generateUuid();
    await this.drizzle.db.insert(ticketComments).values({ id, ticketId, authorId, content });
    const [created] = await this.drizzle.db.select().from(ticketComments).where(eq(ticketComments.id, id)).limit(1);
    return { message: 'Commentaire ajouté avec succès.', data: created };
  }

  async update(id: string, currentUser: JwtPayload, content: string) {
    const comment = await this.findOne(id);

    if (comment.authorId !== currentUser.sub) {
      if (currentUser.role === 'SUPERVISOR') {
        const [ticket] = await this.drizzle.db
          .select({ assignedTeamId: tickets.assignedTeamId })
          .from(tickets)
          .where(eq(tickets.id, comment.ticketId))
          .limit(1);
        if (!ticket || ticket.assignedTeamId !== currentUser.departmentId) {
          throw new ForbiddenException(
            "Vous n'avez pas le droit de modifier un commentaire sur un ticket hors de votre departement.",
          );
        }
      } else if (currentUser.role !== 'ADMINISTRATOR') {
        throw new ForbiddenException('Vous ne pouvez modifier que vos propres commentaires.');
      }
    }

    await this.drizzle.db.update(ticketComments).set({ content }).where(eq(ticketComments.id, id));
    const [updated] = await this.drizzle.db.select().from(ticketComments).where(eq(ticketComments.id, id)).limit(1);
    return { message: 'Commentaire mis à jour.', data: updated };
  }

  async remove(id: string, currentUser: JwtPayload) {
    const comment = await this.findOne(id);

    if (comment.authorId !== currentUser.sub) {
      if (currentUser.role === 'SUPERVISOR') {
        const [ticket] = await this.drizzle.db
          .select({ assignedTeamId: tickets.assignedTeamId })
          .from(tickets)
          .where(eq(tickets.id, comment.ticketId))
          .limit(1);
        if (!ticket || ticket.assignedTeamId !== currentUser.departmentId) {
          throw new ForbiddenException(
            "Vous n'avez pas le droit de supprimer un commentaire sur un ticket hors de votre departement.",
          );
        }
      } else if (currentUser.role !== 'ADMINISTRATOR') {
        throw new ForbiddenException('Vous ne pouvez supprimer que vos propres commentaires.');
      }
    }

    await this.drizzle.db.delete(ticketComments).where(eq(ticketComments.id, id));
  }

  private async findOne(id: string) {
    const [comment] = await this.drizzle.db.select().from(ticketComments).where(eq(ticketComments.id, id)).limit(1);
    if (!comment) throw new NotFoundException('Commentaire non trouvé.');
    return comment;
  }
}
