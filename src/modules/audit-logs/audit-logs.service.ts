import { Injectable, Logger } from '@nestjs/common';
import { eq, gte, lte, sql, and, or, inArray, SQL } from 'drizzle-orm';
import { generateUuid } from '../../common/helpers/uuidv7.helper';
import { DrizzleProvider } from '../../database/drizzle.provider';
import { auditLogs, users, tickets } from '../../database/schemas';
import { PaginationHelper } from '../../common/helpers/pagination.helper';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

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

  async search(
    filters: {
      userId?: string;
      action?: string;
      entityType?: string;
      entityId?: string;
      from?: string;
      to?: string;
      page?: number;
      limit?: number;
    },
    currentUser?: JwtPayload,
  ) {
    const pageNum = Number(filters.page ?? 1);
    const limitNum = Number(filters.limit ?? 20);
    const offset = PaginationHelper.getOffset(pageNum, limitNum);
    const conditions: SQL<unknown>[] = [];

    if (filters.userId) conditions.push(eq(auditLogs.userId, filters.userId));
    if (filters.action) conditions.push(eq(auditLogs.action, filters.action));
    if (filters.entityType) conditions.push(eq(auditLogs.entityType, filters.entityType));
    if (filters.from) conditions.push(gte(auditLogs.createdAt, new Date(filters.from)));
    if (filters.to) conditions.push(lte(auditLogs.createdAt, new Date(filters.to)));

    // Isolation fine des logs d'audit pour les superviseurs
    if (currentUser?.role === 'SUPERVISOR') {
      const deptId = currentUser.departmentId;

      const userSubquery = this.drizzle.db.select({ id: users.id }).from(users).where(eq(users.departmentId, deptId));

      const ticketSubquery = this.drizzle.db
        .select({ id: tickets.id })
        .from(tickets)
        .where(eq(tickets.assignedTeamId, deptId));

      conditions.push(
        or(
          inArray(auditLogs.userId, userSubquery),
          and(eq(auditLogs.entityType, 'ticket'), inArray(auditLogs.entityId, ticketSubquery)),
        ) as SQL<unknown>,
      );
    }

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
      .limit(limitNum)
      .offset(offset);

    return PaginationHelper.paginate(data, Number(total?.count ?? 0), pageNum, limitNum);
  }

  async findOne(id: string) {
    return this.drizzle.db.select().from(auditLogs).where(eq(auditLogs.id, id)).limit(1);
  }
}
