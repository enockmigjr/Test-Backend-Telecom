import { Injectable, Logger } from '@nestjs/common';
import { eq, gte, lte, sql, and, SQL } from 'drizzle-orm';
import { generateUuid } from '../../common/helpers/uuidv7.helper';
import { DrizzleProvider } from '../../database/drizzle.provider';
import { auditLogs } from '../../database/schemas';
import { PaginationHelper } from '../../common/helpers/pagination.helper';

@Injectable()
export class AuditLogsService {
  private readonly logger = new Logger(AuditLogsService.name);

  constructor(private readonly drizzle: DrizzleProvider) {}

  /**
   * Crée une entrée d'audit (immuable — jamais modifiée).
   */
  async create(
    userId: string,
    action: string,
    entityType: string,
    entityId: string,
    oldValue?: unknown,
    newValue?: unknown,
    ipAddress?: string,
    userAgent?: string,
  ) {
    await this.drizzle.db.insert(auditLogs).values({
      id: generateUuid(),
      userId,
      action,
      entityType,
      entityId,
      oldValue: oldValue ? JSON.parse(JSON.stringify(oldValue)) : null,
      newValue: newValue ? JSON.parse(JSON.stringify(newValue)) : null,
      ipAddress: ipAddress || null,
      userAgent: userAgent || null,
    });
  }

  async search(filters: {
    userId?: string;
    action?: string;
    entityType?: string;
    entityId?: string;
    from?: string;
    to?: string;
    page?: number;
    limit?: number;
  }) {
    const { page = 1, limit = 20 } = filters;
    const offset = PaginationHelper.getOffset(page, limit);
    const conditions: SQL<unknown>[] = [];

    if (filters.userId) conditions.push(eq(auditLogs.userId, filters.userId));
    if (filters.action) conditions.push(eq(auditLogs.action, filters.action));
    if (filters.entityType) conditions.push(eq(auditLogs.entityType, filters.entityType));
    if (filters.from) conditions.push(gte(auditLogs.createdAt, new Date(filters.from)));
    if (filters.to) conditions.push(lte(auditLogs.createdAt, new Date(filters.to)));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [total] = await this.drizzle.db
      .select({ count: sql<number>`count(*)` })
      .from(auditLogs)
      .where(where);

    const data = await this.drizzle.db
      .select()
      .from(auditLogs)
      .where(where)
      .orderBy(sql`${auditLogs.createdAt} desc`)
      .limit(limit)
      .offset(offset);

    return PaginationHelper.paginate(data, total?.count || 0, page, limit);
  }

  async findOne(id: string) {
    return this.drizzle.db.select().from(auditLogs).where(eq(auditLogs.id, id)).limit(1);
  }
}
