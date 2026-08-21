/**
 * ============================================================================
 * FICHIER : src/modules/notifications/notifications.service.ts
 * RÔLE : Service de gestion de la persistance et de la lecture des notifications in-app.
 * EXPLICATION :
 * Ce service gère les opérations sur les notifications enregistrées dans PostgreSQL (`notifications`) :
 * 1. `create` : Insère une nouvelle notification avec un UUIDv7, un titre, un message et des références optionnelles (ticketId, commentId...).
 * 2. `findAll` & `getUnread` : Récupère les notifications d'un utilisateur triées par date décroissante.
 * 3. `markAsRead` & `markAllAsRead` : Met à jour `isRead = true` et `readAt = NOW()` pour une ou toutes les notifications non lues.
 * ============================================================================
 */

import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { eq, and, sql } from 'drizzle-orm';
import { generateUuid } from '../../common/helpers/uuidv7.helper';
import { DrizzleProvider } from '../../database/drizzle.provider';
import { notifications } from '../../database/schemas';
import { PaginationHelper } from '../../common/helpers/pagination.helper';

/**
 * Service orchestrant la boîte de réception des notifications in-app des agents et superviseurs.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly drizzle: DrizzleProvider) {}

  /**
   * Extrait la liste paginée des notifications d'un utilisateur.
   *
   * @param userId Identifiant unique de l'utilisateur destinataire.
   * @param page Numéro de page.
   * @param limit Nombre de notifications par page.
   */
  async findAll(userId: string, page = 1, limit = 20) {
    const pageNum = Number(page ?? 1);
    const limitNum = Number(limit ?? 20);
    const where = eq(notifications.userId, userId);
    const offset = PaginationHelper.getOffset(pageNum, limitNum);

    const [total] = await this.drizzle.db
      .select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(where);

    const data = await this.drizzle.db
      .select()
      .from(notifications)
      .where(where)
      .orderBy(sql`${notifications.createdAt} desc`)
      .limit(limitNum)
      .offset(offset);

    return PaginationHelper.paginate(data, Number(total?.count ?? 0), pageNum, limitNum);
  }

  /**
   * Récupère la liste de toutes les notifications non encore consultées (`isRead = false`).
   *
   * @param userId UUID de l'utilisateur.
   */
  async getUnread(userId: string, limit = 50) {
    const capped = Math.min(Math.max(Number(limit) || 50, 1), 100);
    return this.drizzle.db
      .select()
      .from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)))
      .orderBy(sql`${notifications.createdAt} desc`)
      .limit(capped);
  }

  /**
   * Enregistre une nouvelle notification en base de données.
   *
   * @param userId Destinataire de la notification.
   * @param type Type d'événement (ex: TICKET_ASSIGNED, SLA_WARNING...).
   * @param title Titre concis.
   * @param message Corps de la notification.
   * @param referenceType Entité liée (ex: 'ticket').
   * @param referenceId UUID de l'entité liée.
   * @returns L'identifiant UUIDv7 de la notification créée.
   */
  async create(
    userId: string,
    type: typeof notifications.$inferSelect.type,
    title: string,
    message: string,
    referenceType?: string,
    referenceId?: string,
  ) {
    const id = generateUuid();
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

  /**
   * Marque une notification spécifique comme lue.
   *
   * @param id UUID de la notification.
   * @param userId UUID de l'utilisateur propriétaire.
   * @throws NotFoundException si la notification n'existe pas ou n'appartient pas à l'utilisateur.
   */
  async markAsRead(id: string, userId: string) {
    const [updated] = await this.drizzle.db
      .update(notifications)
      .set({ isRead: true, readAt: new Date() })
      .where(and(eq(notifications.id, id), eq(notifications.userId, userId), eq(notifications.isRead, false)))
      .returning({ id: notifications.id });
    if (!updated) throw new NotFoundException('Notification non trouvée ou déjà lue.');
    return { message: 'Notification marquée comme lue.' };
  }

  /**
   * Marque l'ensemble des notifications non lues d'un utilisateur comme lues.
   *
   * @param userId UUID de l'utilisateur.
   */
  async markAllAsRead(userId: string) {
    await this.drizzle.db
      .update(notifications)
      .set({ isRead: true, readAt: new Date() })
      .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
    return { message: 'Toutes les notifications sont marquées comme lues.' };
  }
}
