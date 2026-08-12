/**
 * ============================================================================
 * FICHIER : src/modules/attachments/attachments.service.ts
 * RÔLE : Service de gestion métier des pièces jointes (fichiers attachés aux tickets, commentaires ou notes).
 * EXPLICATION :
 * Ce service orchestre le cycle de vie des fichiers téléversés :
 * 1. `upload` : Valide la taille (max 10 Mo) et le type MIME (PDF, JPEG, PNG, WEBP, TXT) via `isAllowedAttachment`. Assainit le nom du fichier (`safeName`), génère une clé de stockage horodatée, sauvegarde le fichier physiquement et enregistre l'entrée dans PostgreSQL. En cas d'échec SQL, annule l'écriture physique (`storage.delete`).
 * 2. `findAllForTicket` : Liste paginée des pièces jointes d'un ticket (directes ou liées à des commentaires/notes), en masquant les pièces jointes des notes internes aux techniciens terrain (`FIELD_TECHNICIAN`).
 * 3. `remove` : Supprime physiquement et en base une pièce jointe (autorisé uniquement pour l'auteur de l'envoi, un SUPERVISOR ou un ADMINISTRATOR).
 * ============================================================================
 */

import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { and, count, eq, isNull, or, sql } from 'drizzle-orm';
import { basename } from 'path';
import { normalizePagination } from '../../common/helpers/normalized-pagination.helper';
import { PaginationHelper } from '../../common/helpers/pagination.helper';
import { generateUuid } from '../../common/helpers/uuidv7.helper';
import { AttachmentAssociation, TicketAccessService } from '../../common/services/ticket-access.service';
import { DrizzleProvider } from '../../database/drizzle.provider';
import { attachments, ticketComments, ticketInternalNotes, tickets } from '../../database/schemas';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { isAllowedAttachment, MAX_ATTACHMENT_SIZE } from './attachment-upload.config';
import { LocalStorageService } from './storage/local-storage.service';
import { internalActor, toTicketActorColumns } from '../tickets/domain/ticket-actor';

/**
 * Service gérant la persistance en base et le stockage physique des pièces jointes.
 */
@Injectable()
export class AttachmentsService {
  private readonly logger = new Logger(AttachmentsService.name);

  constructor(
    private readonly drizzle: DrizzleProvider,
    private readonly storage: LocalStorageService,
    private readonly ticketAccess: TicketAccessService,
  ) {}

  /**
   * Valide et enregistre une nouvelle pièce jointe associée à un ticket, commentaire ou note interne.
   *
   * @param file Fichier téléversé par Multer (`Express.Multer.File`).
   * @param user Utilisateur authentifié ayant soumis le fichier.
   * @param association Cible de rattachement (`ticketId`, `commentId`, ou `internalNoteId`).
   * @returns Un objet de succès contenant l'entité enregistrée.
   */
  async upload(file: Express.Multer.File | undefined, user: JwtPayload, association: AttachmentAssociation) {
    if (!file) throw new BadRequestException('Aucun fichier fourni.');
    if (file.size > MAX_ATTACHMENT_SIZE) throw new BadRequestException('Fichier trop volumineux.');
    if (!isAllowedAttachment(file)) throw new BadRequestException('Type de fichier non autorisé.');
    const parentTicketId = await this.ticketAccess.resolveVisibleParent(association, user);
    const [parentTicket] = await this.drizzle.db
      .select({ supportIntegrationId: tickets.supportIntegrationId })
      .from(tickets)
      .where(eq(tickets.id, parentTicketId))
      .limit(1);

    // Assainissement du nom de fichier original (caractères alphanumériques uniquement)
    const safeName = basename(file.originalname).replace(/[^a-zA-Z0-9._-]/g, '_');
    const now = new Date();
    const objectKey = `tickets/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${generateUuid()}-${safeName}`;
    await this.storage.upload(file, objectKey);

    const id = generateUuid();
    try {
      const actorColumns = toTicketActorColumns(internalActor(user.sub), parentTicket?.supportIntegrationId ?? undefined);
      const { userId, ...actorRest } = actorColumns;
      await this.drizzle.db.insert(attachments).values({
        id,
        ticketId: association.ticketId ?? null,
        commentId: association.commentId ?? null,
        internalNoteId: association.internalNoteId ?? null,
        supportMessageId: null,
        ...actorRest,
        uploadedBy: userId,
        objectKey,
        bucketName: 'default',
        originalFilename: safeName,
        mimeType: file.mimetype,
        fileSize: file.size,
        scanStatus: 'NOT_REQUIRED',
      });
    } catch (error) {
      // Rollback : suppression du fichier écrit sur disque si l'insertion PostgreSQL échoue
      await this.storage.delete(objectKey);
      throw error;
    }

    const created = await this.findOne(id);
    return { message: 'Fichier téléversé avec succès.', data: created };
  }

  /**
   * Récupère la liste paginée de toutes les pièces jointes d'un ticket.
   *
   * @param ticketId Identifiant UUIDv7 du ticket.
   * @param user Utilisateur authentifié (pour le contrôle de visibilité des notes internes).
   * @param page Numéro de page (par défaut 1).
   * @param limit Nombre d'éléments par page (par défaut 20).
   */
  async findAllForTicket(ticketId: string, user: JwtPayload, page = 1, limit = 20) {
    await this.ticketAccess.assertTicketVisible(ticketId, user);
    const pagination = normalizePagination(page, limit);
    const parentCondition = or(
      eq(attachments.ticketId, ticketId),
      eq(ticketComments.ticketId, ticketId),
      eq(ticketInternalNotes.ticketId, ticketId),
    );

    // Masquage des pièces jointes de notes internes pour les techniciens terrain
    const visibility = user.role === 'FIELD_TECHNICIAN' ? isNull(attachments.internalNoteId) : undefined;
    const where = and(parentCondition, visibility);

    const [total] = await this.drizzle.db
      .select({ count: count() })
      .from(attachments)
      .leftJoin(ticketComments, eq(attachments.commentId, ticketComments.id))
      .leftJoin(ticketInternalNotes, eq(attachments.internalNoteId, ticketInternalNotes.id))
      .where(where);

    const rows = await this.drizzle.db
      .select()
      .from(attachments)
      .leftJoin(ticketComments, eq(attachments.commentId, ticketComments.id))
      .leftJoin(ticketInternalNotes, eq(attachments.internalNoteId, ticketInternalNotes.id))
      .where(where)
      .orderBy(sql`${attachments.createdAt} desc`)
      .limit(pagination.limit)
      .offset(PaginationHelper.getOffset(pagination.page, pagination.limit));

    const data = rows.map((row) => row.attachments);
    return PaginationHelper.paginate(data, Number(total?.count ?? 0), pagination.page, pagination.limit);
  }

  /**
   * Recherche et retourne la métadonnée d'une pièce jointe après avoir contrôlé les droits de l'utilisateur.
   */
  async findOneForUser(id: string, user: JwtPayload) {
    const attachment = await this.findOne(id);
    await this.ticketAccess.resolveVisibleParent(attachment, user);
    return attachment;
  }

  async findOneDownloadableForUser(id: string, user: JwtPayload) {
    const attachment = await this.findOneForUser(id, user);
    if (attachment.scanStatus !== 'CLEAN' && attachment.scanStatus !== 'NOT_REQUIRED') {
      throw new NotFoundException('Pièce jointe indisponible.');
    }
    return attachment;
  }

  /**
   * Supprime une pièce jointe du stockage et de la base de données PostgreSQL.
   */
  async remove(id: string, user: JwtPayload) {
    const attachment = await this.findOneForUser(id, user);
    const canRemove = attachment.uploadedBy === user.sub || user.role === 'SUPERVISOR' || user.role === 'ADMINISTRATOR';
    if (!canRemove) throw new ForbiddenException("Vous n'avez pas le droit de supprimer cette pièce jointe.");

    await this.storage.delete(attachment.objectKey);
    await this.drizzle.db.delete(attachments).where(eq(attachments.id, id));
  }

  /**
   * Requête interne de sélection d'une pièce jointe par ID.
   */
  private async findOne(id: string) {
    const [attachment] = await this.drizzle.db.select().from(attachments).where(eq(attachments.id, id)).limit(1);
    if (!attachment) throw new NotFoundException('Pièce jointe non trouvée.');
    return attachment;
  }
}
