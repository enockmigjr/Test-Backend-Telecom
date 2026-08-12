import { Injectable, NotFoundException } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DrizzleProvider } from '../../database/drizzle.provider';
import { attachments, supportMessages } from '../../database/schemas';
import { PublicPrincipal } from '../external-identity/interfaces/public-principal.interface';
import { PublicTicketAccessService } from '../public-support/services/public-ticket-access.service';
import { PublicAttachmentUploadService } from './public-attachment-upload.service';
import { PublicUploadReservation } from './public-attachment-idempotency.service';
import { LocalStorageService } from './storage/local-storage.service';

@Injectable()
export class PublicConversationAttachmentsService {
  constructor(
    private readonly drizzle: DrizzleProvider,
    private readonly storage: LocalStorageService,
    private readonly access: PublicTicketAccessService,
    private readonly uploads: PublicAttachmentUploadService,
  ) {}

  /** Upload public sur une conversation pré-ticket — logique commune dans PublicAttachmentUploadService. */
  async upload(
    conversationId: string,
    principal: PublicPrincipal,
    file: Express.Multer.File | undefined,
    reservation: PublicUploadReservation,
  ) {
    return this.uploads.upload({ kind: 'conversation', conversationId }, principal, file, reservation);
  }

  async list(conversationId: string, principal: PublicPrincipal) {
    await this.access.requireConversation(conversationId, principal);
    const data = await this.query(conversationId, principal);
    return { data: data.map(metadata) };
  }

  async status(conversationId: string, attachmentId: string, principal: PublicPrincipal) {
    const value = await this.find(conversationId, attachmentId, principal);
    return { data: metadata(value) };
  }

  async download(conversationId: string, attachmentId: string, principal: PublicPrincipal) {
    const attachment = await this.find(conversationId, attachmentId, principal);
    if (attachment.scanStatus !== 'CLEAN') throw new NotFoundException('Pièce jointe indisponible.');
    return { attachment, buffer: await this.storage.download(attachment.objectKey) };
  }

  private async find(conversationId: string, attachmentId: string, principal: PublicPrincipal) {
    await this.access.requireConversation(conversationId, principal);
    const [value] = await this.query(conversationId, principal, attachmentId);
    if (!value) throw new NotFoundException('Pièce jointe introuvable.');
    return value;
  }

  private query(conversationId: string, principal: PublicPrincipal, attachmentId?: string) {
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
      .innerJoin(supportMessages, eq(attachments.supportMessageId, supportMessages.id))
      .where(
        and(
          attachmentId ? eq(attachments.id, attachmentId) : undefined,
          eq(supportMessages.conversationId, conversationId),
          eq(attachments.supportIntegrationId, principal.supportIntegrationId),
        ),
      );
  }
}

function metadata(value: {
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
