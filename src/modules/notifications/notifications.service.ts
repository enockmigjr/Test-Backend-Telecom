import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { eq, and, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { DrizzleProvider } from '../../database/drizzle.provider';
import { notifications } from '../../database/schemas';
import { PaginationHelper } from '../../common/helpers/pagination.helper';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly drizzle: DrizzleProvider) {}

  async findAll(userId: string, page = 1, limit = 20) {
    const where = eq(notifications.userId, userId);
    const offset = PaginationHelper.getOffset(page, limit);

    const [total] = await this.drizzle.db
      .select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(where);

    const data = await this.drizzle.db
      .select()
      .from(notifications)
      .where(where)
      .orderBy(sql`${notifications.createdAt} desc`)
      .limit(limit)
      .offset(offset);

    return PaginationHelper.paginate(data, total?.count || 0, page, limit);
  }

  async getUnread(userId: string) {
    return this.drizzle.db
      .select()
      .from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)))
      .orderBy(sql`${notifications.createdAt} desc`);
  }

  async create(
    userId: string,
    type: typeof notifications.$inferSelect.type,
    title: string,
    message: string,
    referenceType?: string,
    referenceId?: string,
  ) {
    const id = uuidv4();
    await this.drizzle.db.insert(notifications).values({
      id,
      userId,
      type,
      title,
      message,
      referenceType: referenceType || null,
      referenceId: referenceId || null,
    });
    return id;
  }

  async markAsRead(id: string, userId: string) {
    const [notif] = await this.drizzle.db.select().from(notifications).where(eq(notifications.id, id)).limit(1);
    if (!notif) throw new NotFoundException('Notification non trouvée.');
    if (notif.userId !== userId) throw new NotFoundException('Notification non trouvée.');
    await this.drizzle.db
      .update(notifications)
      .set({ isRead: true, readAt: new Date() })
      .where(eq(notifications.id, id));
    return { message: 'Notification marquée comme lue.' };
  }

  async markAllAsRead(userId: string) {
    await this.drizzle.db
      .update(notifications)
      .set({ isRead: true, readAt: new Date() })
      .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
    return { message: 'Toutes les notifications sont marquées comme lues.' };
  }
}
