/**
 * ============================================================================
 * FICHIER : src/modules/audit-logs/audit-logs.service.ts
 * RÔLE : Service de journalisation immuable et d'audit de sécurité des actions système.
 * EXPLICATION :
 * Ce service gère la piste d'audit (Audit Trail) de l'application télécom :
 * 1. `create` : Insère de manière immuable une trace d'action utilisateur (création/modification/suppression de tickets, réallocations, changements de statut). Conserve l'état précédent (`oldValue`) et l'état nouveau (`newValue`) au format JSONB avec l'adresse IP et le User-Agent.
 * 2. Immutabilité garantie : Aucune méthode de mise à jour ou de suppression n'existe dans ce service.
 * 3. `search` & `findOne` : Offrent un accès filtré et paginé aux logs d'audit. Les administrateurs disposent d'une vue globale ; les superviseurs (`SUPERVISOR`) sont strictement isolés aux membres et tickets de leur département via `supervisorVisibility`.
 * ============================================================================
 */

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { eq, gte, lte, sql, and, or, inArray, SQL } from 'drizzle-orm';
import { generateUuid } from '../../common/helpers/uuidv7.helper';
import { DrizzleProvider } from '../../database/drizzle.provider';
import { auditLogs, users, tickets } from '../../database/schemas';
import { PaginationHelper } from '../../common/helpers/pagination.helper';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { normalizePagination } from '../../common/helpers/normalized-pagination.helper';

/**
 * Service gérant la persistance et la consultation des journaux d'audit immuables.
 */
@Injectable()
export class AuditLogsService {
  private readonly logger = new Logger(AuditLogsService.name);

  constructor(private readonly drizzle: DrizzleProvider) {}

  /**
   * Enregistre une entrée d'audit immuable dans la table PostgreSQL `audit_logs`.
   *
   * @param userId UUIDv7 de l'utilisateur émetteur de l'action.
   * @param action Code verbe de l'action (ex: 'TICKET_CREATED', 'TICKET_RESOLVED').
   * @param entityType Nom de l'entité visée (ex: 'ticket', 'user', 'comment').
   * @param entityId Identifiant UUID de l'entité visée.
   * @param oldValue État précédent de l'entité (facultatif).
   * @param newValue État mis à jour de l'entité (facultatif).
   * @param ipAddress Adresse IP du client.
   * @param userAgent Empreinte du navigateur/client HTTP.
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

  /**
   * Recherche paginée et filtrée dans les journaux d'audit de sécurité.
   *
   * @param filters Critères de recherche (userId, action, entityType, dates).
   * @param currentUser Utilisateur effectuant la requête (pour appliquer le cloisonnement).
   */
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

    // Application de la restriction de visibilité par département pour les superviseurs
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

  /**
   * Extrait une entrée d'audit unique par son UUID en contrôlant le périmètre d'accès.
   */
  async findOne(id: string, currentUser: JwtPayload) {
    const conditions: SQL<unknown>[] = [eq(auditLogs.id, id)];
    if (currentUser.role === 'SUPERVISOR') conditions.push(this.supervisorVisibility(currentUser));
    const [entry] = await this.drizzle.db
      .select()
      .from(auditLogs)
      .where(and(...conditions))
      .limit(1);
    if (!entry) throw new NotFoundException("Entrée d'audit introuvable.");
    return entry;
  }

  /**
   * Construit la sous-requête Drizzle isolant les logs d'audit visibles par un superviseur.
   * Restreint les entrées aux actions exécutées par des agents de son département ou ciblant des tickets de son département.
   */
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
