import { Injectable, NotFoundException } from '@nestjs/common';
import { and, eq, isNull, or } from 'drizzle-orm';
import { DrizzleProvider } from '../../database/drizzle.provider';
import { attachments, supportConversations, supportMessages, ticketComments } from '../../database/schemas';
import { PublicPrincipal } from '../external-identity/interfaces/public-principal.interface';
import { PublicTicketAccessService } from '../public-support/services/public-ticket-access.service';
import { PublicAttachmentUploadService } from './public-attachment-upload.service';
import { PublicUploadReservation } from './public-attachment-idempotency.service';
import { LocalStorageService } from './storage/local-storage.service';

@Injectable()
export class PublicAttachmentsService {
  constructor(
    private readonly drizzle: DrizzleProvider,
    private readonly storage: LocalStorageService,
    private readonly access: PublicTicketAccessService,
    private readonly uploads: PublicAttachmentUploadService,
  ) {}

  /** Upload public sur un ticket existant — logique commune dans PublicAttachmentUploadService. */
  async upload(
    ticketId: string,
    principal: PublicPrincipal,
    file: Express.Multer.File | undefined,
    reservation: PublicUploadReservation,
  ) {
    return this.uploads.upload({ kind: 'ticket', ticketId }, principal, file, reservation);
  }

  async list(ticketId: string, principal: PublicPrincipal) {
    await this.access.requireTicket(ticketId, principal);
    const rows = await this.basePublicQuery(ticketId, principal).orderBy(attachments.createdAt);
    return { data: rows.map(publicMetadata) };
  }

  async status(ticketId: string, attachmentId: string, principal: PublicPrincipal) {
    const attachment = await this.findPublic(ticketId, attachmentId, principal);
    return { data: publicMetadata(attachment) };
  }

  async download(ticketId: string, attachmentId: string, principal: PublicPrincipal) {
    const attachment = await this.findPublic(ticketId, attachmentId, principal);
    if (attachment.scanStatus !== 'CLEAN') throw new NotFoundException('Pièce jointe indisponible.');
    return { attachment, buffer: await this.storage.download(attachment.objectKey) };
  }

  private async findPublic(ticketId: string, attachmentId: string, principal: PublicPrincipal) {
    await this.access.requireTicket(ticketId, principal);
    const [attachment] = await this.basePublicQuery(ticketId, principal, attachmentId).limit(1);
    if (!attachment) throw new NotFoundException('Pièce jointe introuvable.');
    return attachment;
  }

  private basePublicQuery(ticketId: string, principal: PublicPrincipal, attachmentId?: string) {
    return this.drizzle.db
      .select({
        id: attachments.id,
        originalFilename: attachments.originalFilename,
        mimeType: attachments.mimeType,
        fileSize: attachments.fileSize,
        scanStatus: attachments.scanStatus,
        scanError: attachments.scanError,
        objectKey: attachments.objectKey,
        createdAt: attachments.createdAt,
      })
      .from(attachments)
      .leftJoin(ticketComments, eq(attachments.commentId, ticketComments.id))
      .leftJoin(supportMessages, eq(attachments.supportMessageId, supportMessages.id))
      .leftJoin(supportConversations, eq(supportMessages.conversationId, supportConversations.id))
      .where(
        and(
          attachmentId ? eq(attachments.id, attachmentId) : undefined,
          this.parentCondition(ticketId),
          eq(attachments.supportIntegrationId, principal.supportIntegrationId),
          isNull(attachments.internalNoteId),
        ),
      );
  }

  private parentCondition(ticketId: string) {
    return or(
      eq(attachments.ticketId, ticketId),
      eq(ticketComments.ticketId, ticketId),
      eq(supportConversations.ticketId, ticketId),
    );
  }
}

function publicMetadata(value: {
  id: string;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  scanStatus: string;
  scanError: string | null;
  createdAt: Date;
}) {
  return {
    id: value.id,
    filename: value.originalFilename,
    mimeType: value.mimeType,
    fileSize: value.fileSize,
    scanStatus: value.scanStatus,
    ...(value.scanStatus === 'ERROR' ? { error: value.scanError } : {}),
    createdAt: value.createdAt,
  };
}
