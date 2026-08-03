import { BadRequestException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { and, count, eq, gte, isNull, or } from 'drizzle-orm';
import { basename } from 'path';
import { generateUuid } from '../../common/helpers/uuidv7.helper';
import { DrizzleProvider } from '../../database/drizzle.provider';
import {
  attachments,
  outboxEvents,
  supportConversations,
  supportIntegrations,
  supportMessages,
  ticketComments,
} from '../../database/schemas';
import { PublicPrincipal } from '../external-identity/interfaces/public-principal.interface';
import { PublicTicketAccessService } from '../public-support/services/public-ticket-access.service';
import { MAX_ATTACHMENT_SIZE } from './attachment-upload.config';
import { ANTIVIRUS_SCANNER, AntivirusScanner } from './security/antivirus-scanner.interface';
import { LocalStorageService } from './storage/local-storage.service';
import { Inject } from '@nestjs/common';

@Injectable()
export class PublicAttachmentsService {
  constructor(
    private readonly drizzle: DrizzleProvider,
    private readonly storage: LocalStorageService,
    private readonly access: PublicTicketAccessService,
    @Inject(ANTIVIRUS_SCANNER) private readonly antivirus: AntivirusScanner,
  ) {}

  async upload(ticketId: string, principal: PublicPrincipal, file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('Aucun fichier fourni.');
    try {
      await this.access.requireTicket(ticketId, principal);
      const policy = await this.requirePolicy(principal.supportIntegrationId);
      const maxBytes = positiveNumber(policy.quotaPolicy['attachmentMaxBytes'], MAX_ATTACHMENT_SIZE);
      if (file.size > Math.min(maxBytes, MAX_ATTACHMENT_SIZE))
        throw new BadRequestException('Fichier trop volumineux.');
      await this.assertQuota(principal, positiveNumber(policy.quotaPolicy['attachmentUploadsPerHour'], 20));
      if (!(await this.antivirus.health())) throw new ServiceUnavailableException('Analyse antivirus indisponible.');
    } catch (error: unknown) {
      await this.storage.discardIncoming(file);
      throw error;
    }

    const id = generateUuid();
    const safeName = basename(file.originalname).replace(/[^a-zA-Z0-9._-]/g, '_') || 'attachment';
    const now = new Date();
    const relativeKey = `attachments/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${id}-${safeName}`;
    const objectKey = await this.storage.quarantine(file, relativeKey);
    try {
      await this.drizzle.runInTransaction(async () => {
        await this.drizzle.db.insert(attachments).values({
          id,
          ticketId,
          actorType: 'EXTERNAL_REQUESTER',
          externalRequesterId: principal.externalRequesterId,
          supportIntegrationId: principal.supportIntegrationId,
          objectKey,
          bucketName: 'quarantine',
          originalFilename: safeName,
          mimeType: 'application/octet-stream',
          fileSize: file.size,
          scanStatus: 'QUARANTINED',
        });
        const mutationId = generateUuid();
        await this.drizzle.db.insert(outboxEvents).values({
          id: generateUuid(),
          mutationId,
          schemaVersion: 1,
          supportIntegrationId: principal.supportIntegrationId,
          actorType: 'EXTERNAL_REQUESTER',
          externalRequesterId: principal.externalRequesterId,
          aggregateType: 'ATTACHMENT',
          aggregateId: id,
          eventType: 'PUBLIC_ATTACHMENT_QUARANTINED',
          deduplicationKey: `public-attachment-quarantined:${mutationId}`,
          payload: { attachmentId: id, ticketId },
        });
      });
    } catch (error: unknown) {
      await this.storage.deleteQuarantine(objectKey);
      throw error;
    }
    return { data: { id, filename: safeName, fileSize: file.size, scanStatus: 'QUARANTINED' as const } };
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

  private async requirePolicy(integrationId: string) {
    const [value] = await this.drizzle.db
      .select({ features: supportIntegrations.features, quotaPolicy: supportIntegrations.quotaPolicy })
      .from(supportIntegrations)
      .where(and(eq(supportIntegrations.id, integrationId), eq(supportIntegrations.status, 'ACTIVE')))
      .limit(1);
    if (!value || value.features['publicAttachments'] !== true) throw new NotFoundException('Fonction indisponible.');
    return value;
  }

  private async assertQuota(principal: PublicPrincipal, limit: number) {
    const [value] = await this.drizzle.db
      .select({ count: count() })
      .from(attachments)
      .where(
        and(
          eq(attachments.supportIntegrationId, principal.supportIntegrationId),
          eq(attachments.externalRequesterId, principal.externalRequesterId),
          gte(attachments.createdAt, new Date(Date.now() - 60 * 60_000)),
        ),
      );
    if (Number(value?.count ?? 0) >= limit) throw new BadRequestException('Quota de pièces jointes atteint.');
  }
}

function positiveNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : fallback;
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
