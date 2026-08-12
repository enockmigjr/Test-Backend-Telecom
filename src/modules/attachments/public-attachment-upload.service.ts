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
import { policyNumber } from '../../common/utils/helpers';
import { DrizzleProvider } from '../../database/drizzle.provider';
import { attachments, outboxEvents, supportIntegrations, supportMessages } from '../../database/schemas';
import { PublicPrincipal } from '../external-identity/interfaces/public-principal.interface';
import { PublicTicketAccessService } from '../public-support/services/public-ticket-access.service';
import { MAX_ATTACHMENT_SIZE } from './attachment-upload.config';
import { PublicUploadReservation } from './public-attachment-idempotency.service';
import { ANTIVIRUS_SCANNER, AntivirusScanner } from './security/antivirus-scanner.interface';
import { LocalStorageService } from './storage/local-storage.service';

/** Cible d'un upload public : ticket déjà créé ou message d'une conversation pré-ticket. */
export type PublicAttachmentTarget =
  | { readonly kind: 'ticket'; readonly ticketId: string }
  | { readonly kind: 'conversation'; readonly conversationId: string };

/**
 * Logique commune d'upload public : contrôle d'accès, politique d'intégration,
 * quotas, quarantaine, transaction (message de transport + attachment + outbox).
 *
 * Unifiée depuis `public-attachments.service.ts` (ticket) et
 * `public-conversation-attachments.service.ts` (conversation pré-ticket),
 * qui n'ont plus que leurs lectures/listes spécifiques.
 */
@Injectable()
export class PublicAttachmentUploadService {
  constructor(
    private readonly drizzle: DrizzleProvider,
    private readonly storage: LocalStorageService,
    private readonly access: PublicTicketAccessService,
    @Inject(ANTIVIRUS_SCANNER) private readonly antivirus: AntivirusScanner,
  ) {}

  async upload(
    target: PublicAttachmentTarget,
    principal: PublicPrincipal,
    file: Express.Multer.File | undefined,
    reservation: PublicUploadReservation,
  ): Promise<{ data: { id: string; filename: string; fileSize: number; scanStatus: 'QUARANTINED' } }> {
    if (!file) throw new BadRequestException('Aucun fichier fourni.');
    try {
      if (target.kind === 'ticket') {
        await this.access.requireTicket(target.ticketId, principal);
      } else {
        const conversation = await this.access.requireConversation(target.conversationId, principal);
        if (conversation.status !== 'OPEN' || conversation.ticketId) {
          throw new ConflictException('Conversation finalisée.');
        }
      }
      const integration = await this.requireIntegration(principal.supportIntegrationId);
      const maxBytes = Math.min(
        policyNumber(integration.quotaPolicy, 'attachmentMaxBytes', MAX_ATTACHMENT_SIZE),
        MAX_ATTACHMENT_SIZE,
      );
      if (file.size > maxBytes) throw new BadRequestException('Fichier trop volumineux.');
      const hourly = policyNumber(integration.quotaPolicy, 'attachmentUploadsPerHour', 20);
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
      if (!(await this.antivirus.health())) throw new ServiceUnavailableException('Analyse antivirus indisponible.');
    } catch (error: unknown) {
      await this.storage.discardIncoming(file);
      throw error;
    }

    const id = generateUuid();
    const safeName = basename(file.originalname).replace(/[^a-zA-Z0-9._-]/g, '_') || 'attachment';
    const now = new Date();
    const relativeKey =
      target.kind === 'ticket'
        ? `attachments/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${id}-${safeName}`
        : `attachments/pre-ticket/${id}-${safeName}`;
    const objectKey = await this.storage.quarantine(file, relativeKey);
    try {
      await this.drizzle.runInTransaction(async () => {
        const messageId = target.kind === 'conversation' ? generateUuid() : null;
        if (target.kind === 'conversation' && messageId) {
          await this.drizzle.db.insert(supportMessages).values({
            id: messageId,
            supportIntegrationId: principal.supportIntegrationId,
            conversationId: target.conversationId,
            actorType: 'EXTERNAL_REQUESTER',
            externalRequesterId: principal.externalRequesterId,
            direction: 'INBOUND',
            content: `Pièce jointe : ${safeName}`,
            channelMetadata: { kind: 'ATTACHMENT' },
          });
        }
        await this.drizzle.db.insert(attachments).values({
          id,
          ...(target.kind === 'ticket' ? { ticketId: target.ticketId } : { supportMessageId: messageId }),
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
          payload: {
            attachmentId: id,
            ...(target.kind === 'ticket' ? { ticketId: target.ticketId } : { conversationId: target.conversationId }),
          },
        });
      });
    } catch (error: unknown) {
      await this.storage.deleteQuarantine(objectKey);
      throw error;
    }
    return { data: { id, filename: safeName, fileSize: file.size, scanStatus: 'QUARANTINED' as const } };
  }

  private async requireIntegration(integrationId: string) {
    const [integration] = await this.drizzle.db
      .select({ features: supportIntegrations.features, quotaPolicy: supportIntegrations.quotaPolicy })
      .from(supportIntegrations)
      .where(and(eq(supportIntegrations.id, integrationId), eq(supportIntegrations.status, 'ACTIVE')))
      .limit(1);
    if (!integration) throw new NotFoundException('Fonction indisponible.');
    const attachmentsEnabled =
      integration.features['attachments'] === true || integration.features['publicAttachments'] === true;
    if (!attachmentsEnabled) throw new NotFoundException('Fonction indisponible.');
    return integration;
  }
}
