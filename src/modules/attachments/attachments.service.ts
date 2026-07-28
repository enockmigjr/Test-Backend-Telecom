import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { and, count, eq, isNull, or, sql } from 'drizzle-orm';
import { basename } from 'path';
import { normalizePagination } from '../../common/helpers/normalized-pagination.helper';
import { PaginationHelper } from '../../common/helpers/pagination.helper';
import { generateUuid } from '../../common/helpers/uuidv7.helper';
import { AttachmentAssociation, TicketAccessService } from '../../common/services/ticket-access.service';
import { DrizzleProvider } from '../../database/drizzle.provider';
import { attachments, ticketComments, ticketInternalNotes } from '../../database/schemas';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { isAllowedAttachment, MAX_ATTACHMENT_SIZE } from './attachment-upload.config';
import { LocalStorageService } from './storage/local-storage.service';

@Injectable()
export class AttachmentsService {
  private readonly logger = new Logger(AttachmentsService.name);

  constructor(
    private readonly drizzle: DrizzleProvider,
    private readonly storage: LocalStorageService,
    private readonly ticketAccess: TicketAccessService,
  ) {}

  async upload(file: Express.Multer.File | undefined, user: JwtPayload, association: AttachmentAssociation) {
    if (!file) throw new BadRequestException('Aucun fichier fourni.');
    if (file.size > MAX_ATTACHMENT_SIZE) throw new BadRequestException('Fichier trop volumineux.');
    if (!isAllowedAttachment(file)) throw new BadRequestException('Type de fichier non autorise.');
    await this.ticketAccess.resolveVisibleParent(association, user);

    const safeName = basename(file.originalname).replace(/[^a-zA-Z0-9._-]/g, '_');
    const now = new Date();
    const objectKey = `tickets/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${generateUuid()}-${safeName}`;
    await this.storage.upload(file, objectKey);

    const id = generateUuid();
    try {
      await this.drizzle.db.insert(attachments).values({
        id,
        ticketId: association.ticketId ?? null,
        commentId: association.commentId ?? null,
        internalNoteId: association.internalNoteId ?? null,
        uploadedBy: user.sub,
        objectKey,
        bucketName: 'default',
        originalFilename: safeName,
        mimeType: file.mimetype,
        fileSize: file.size,
      });
    } catch (error) {
      await this.storage.delete(objectKey);
      throw error;
    }

    const created = await this.findOne(id);
    return { message: 'Fichier uploade avec succes.', data: created };
  }

  async findAllForTicket(ticketId: string, user: JwtPayload, page = 1, limit = 20) {
    await this.ticketAccess.assertTicketVisible(ticketId, user);
    const pagination = normalizePagination(page, limit);
    const parentCondition = or(
      eq(attachments.ticketId, ticketId),
      eq(ticketComments.ticketId, ticketId),
      eq(ticketInternalNotes.ticketId, ticketId),
    );
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

  async findOneForUser(id: string, user: JwtPayload) {
    const attachment = await this.findOne(id);
    await this.ticketAccess.resolveVisibleParent(attachment, user);
    return attachment;
  }

  async remove(id: string, user: JwtPayload) {
    const attachment = await this.findOneForUser(id, user);
    const canRemove = attachment.uploadedBy === user.sub || user.role === 'SUPERVISOR' || user.role === 'ADMINISTRATOR';
    if (!canRemove) throw new ForbiddenException("Vous n'avez pas le droit de supprimer cette piece jointe.");
    await this.storage.delete(attachment.objectKey);
    await this.drizzle.db.delete(attachments).where(eq(attachments.id, id));
  }

  private async findOne(id: string) {
    const [attachment] = await this.drizzle.db.select().from(attachments).where(eq(attachments.id, id)).limit(1);
    if (!attachment) throw new NotFoundException('Piece jointe non trouvee.');
    return attachment;
  }
}
