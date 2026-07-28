import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { eq, gte, lte, sql, and, or, inArray, SQL } from 'drizzle-orm';
import { generateUuid } from '../../common/helpers/uuidv7.helper';
import { DrizzleProvider } from '../../database/drizzle.provider';
import { auditLogs, users, tickets } from '../../database/schemas';
import { PaginationHelper } from '../../common/helpers/pagination.helper';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { normalizePagination } from '../../common/helpers/normalized-pagination.helper';

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
    const { page: pageNum, limit: limitNum } = normalizePagination(filters.page, filters.limit);
    const offset = PaginationHelper.getOffset(pageNum, limitNum);
    const conditions: SQL<unknown>[] = [];

    if (filters.userId) conditions.push(eq(auditLogs.userId, filters.userId));
    if (filters.action) conditions.push(eq(auditLogs.action, filters.action));
    if (filters.entityType) conditions.push(eq(auditLogs.entityType, filters.entityType));
    if (filters.from) conditions.push(gte(auditLogs.createdAt, new Date(filters.from)));
    if (filters.to) conditions.push(lte(auditLogs.createdAt, new Date(filters.to)));

    // Isolation fine des logs d'audit pour les superviseurs
    if (currentUser?.role === 'SUPERVISOR') {
      conditions.push(this.supervisorVisibility(currentUser));
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

  async findOne(id: string, currentUser: JwtPayload) {
    const conditions: SQL<unknown>[] = [eq(auditLogs.id, id)];
    if (currentUser.role === 'SUPERVISOR') conditions.push(this.supervisorVisibility(currentUser));
    const [entry] = await this.drizzle.db
      .select()
      .from(auditLogs)
      .where(and(...conditions))
      .limit(1);
    if (!entry) throw new NotFoundException("Entree d'audit introuvable.");
    return entry;
  }

  private supervisorVisibility(currentUser: JwtPayload): SQL<unknown> {
    const userSubquery = this.drizzle.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.departmentId, currentUser.departmentId));
    const ticketSubquery = this.drizzle.db
      .select({ id: tickets.id })
      .from(tickets)
      .where(
        or(eq(tickets.departmentId, currentUser.departmentId), eq(tickets.assignedTeamId, currentUser.departmentId)),
      );
    return or(
      inArray(auditLogs.userId, userSubquery),
      and(eq(auditLogs.entityType, 'ticket'), inArray(auditLogs.entityId, ticketSubquery)),
    ) as SQL<unknown>;
  }
}
