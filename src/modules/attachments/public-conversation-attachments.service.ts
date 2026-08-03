import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { and, count, eq, gte } from 'drizzle-orm';
import { basename } from 'path';
import { generateUuid } from '../../common/helpers/uuidv7.helper';
import { DrizzleProvider } from '../../database/drizzle.provider';
import { attachments, outboxEvents, supportIntegrations, supportMessages } from '../../database/schemas';
import { PublicPrincipal } from '../external-identity/interfaces/public-principal.interface';
import { PublicTicketAccessService } from '../public-support/services/public-ticket-access.service';
import { MAX_ATTACHMENT_SIZE } from './attachment-upload.config';
import { ANTIVIRUS_SCANNER, AntivirusScanner } from './security/antivirus-scanner.interface';
import { LocalStorageService } from './storage/local-storage.service';
import { PublicUploadReservation } from './public-attachment-idempotency.service';

@Injectable()
export class PublicConversationAttachmentsService {
  constructor(
    private readonly drizzle: DrizzleProvider,
    private readonly storage: LocalStorageService,
    private readonly access: PublicTicketAccessService,
    @Inject(ANTIVIRUS_SCANNER) private readonly antivirus: AntivirusScanner,
  ) {}

  async upload(
    conversationId: string,
    principal: PublicPrincipal,
    file: Express.Multer.File | undefined,
    reservation: PublicUploadReservation,
  ) {
    if (!file) throw new BadRequestException('Aucun fichier fourni.');
    try {
      const conversation = await this.access.requireConversation(conversationId, principal);
      if (conversation.status !== 'OPEN' || conversation.ticketId)
        throw new ConflictException('Conversation finalisée.');
      const limits = await this.limits(principal);
      if (file.size > limits.maxBytes) throw new BadRequestException('Fichier trop volumineux.');
      if (!(await this.antivirus.health())) throw new ServiceUnavailableException('Analyse antivirus indisponible.');
    } catch (error: unknown) {
      await this.storage.discardIncoming(file);
      throw error;
    }
    const id = generateUuid();
    const messageId = generateUuid();
    const safeName = basename(file.originalname).replace(/[^a-zA-Z0-9._-]/g, '_') || 'attachment';
    const objectKey = await this.storage.quarantine(file, `attachments/pre-ticket/${id}-${safeName}`);
    try {
      await this.drizzle.runInTransaction(async () => {
        await this.drizzle.db.insert(supportMessages).values({
          id: messageId,
          supportIntegrationId: principal.supportIntegrationId,
          conversationId,
          actorType: 'EXTERNAL_REQUESTER',
          externalRequesterId: principal.externalRequesterId,
          direction: 'INBOUND',
          content: `Pièce jointe : ${safeName}`,
          channelMetadata: { kind: 'ATTACHMENT' },
        });
        await this.drizzle.db.insert(attachments).values({
          id,
          supportMessageId: messageId,
          actorType: 'EXTERNAL_REQUESTER',
          externalRequesterId: principal.externalRequesterId,
          supportIntegrationId: principal.supportIntegrationId,
          objectKey,
          bucketName: 'quarantine',
          originalFilename: safeName,
          mimeType: 'application/octet-stream',
          fileSize: file.size,
          scanStatus: 'QUARANTINED',
          publicUploadKeyHash: reservation.keyHash,
          publicUploadFingerprint: reservation.fingerprint,
          publicUploadIdempotencyExpiresAt: reservation.expiresAt,
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
          payload: { attachmentId: id, conversationId },
        });
      });
    } catch (error: unknown) {
      await this.storage.deleteQuarantine(objectKey);
      throw error;
    }
    return { data: { id, filename: safeName, fileSize: file.size, scanStatus: 'QUARANTINED' as const } };
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

  private async limits(principal: PublicPrincipal) {
    const [integration] = await this.drizzle.db
      .select({ features: supportIntegrations.features, quotaPolicy: supportIntegrations.quotaPolicy })
      .from(supportIntegrations)
      .where(and(eq(supportIntegrations.id, principal.supportIntegrationId), eq(supportIntegrations.status, 'ACTIVE')))
      .limit(1);
    if (!integration || integration.features['publicAttachments'] !== true)
      throw new NotFoundException('Fonction indisponible.');
    const hourly = numberPolicy(integration.quotaPolicy['attachmentUploadsPerHour'], 20);
    const [used] = await this.drizzle.db
      .select({ count: count() })
      .from(attachments)
      .where(
        and(
          eq(attachments.supportIntegrationId, principal.supportIntegrationId),
          eq(attachments.externalRequesterId, principal.externalRequesterId),
          gte(attachments.createdAt, new Date(Date.now() - 60 * 60_000)),
        ),
      );
    if (Number(used?.count ?? 0) >= hourly) throw new BadRequestException('Quota de pièces jointes atteint.');
    return {
      maxBytes: Math.min(
        numberPolicy(integration.quotaPolicy['attachmentMaxBytes'], MAX_ATTACHMENT_SIZE),
        MAX_ATTACHMENT_SIZE,
      ),
    };
  }
}

function numberPolicy(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : fallback;
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
