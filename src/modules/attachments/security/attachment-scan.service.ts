import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, eq, inArray, lt, or } from 'drizzle-orm';
import { DrizzleProvider } from '../../../database/drizzle.provider';
import { attachments, supportIntegrations } from '../../../database/schemas';
import { LocalStorageService } from '../storage/local-storage.service';
import { ANTIVIRUS_SCANNER, AntivirusScanner } from './antivirus-scanner.interface';
import { AttachmentContentInspectorService } from './attachment-content-inspector.service';
import { PublicSupportGateway } from '../../../websocket/public-support.gateway';
import { errorCategory, stringArray } from '../../../common/utils/helpers';

const STALE_SCAN_MS = 2 * 60_000;

@Injectable()
export class AttachmentScanService {
  private readonly logger = new Logger(AttachmentScanService.name);

  constructor(
    private readonly drizzle: DrizzleProvider,
    private readonly storage: LocalStorageService,
    private readonly inspector: AttachmentContentInspectorService,
    @Inject(ANTIVIRUS_SCANNER) private readonly antivirus: AntivirusScanner,
    private readonly realtime: PublicSupportGateway,
  ) {}

  async process(attachmentId: string, finalAttempt: boolean): Promise<void> {
    const now = new Date();
    const [attachment] = await this.drizzle.db
      .update(attachments)
      .set({
        scanStatus: 'SCANNING',
        scannedAt: now,
        scanError: null,
      })
      .where(
        and(
          eq(attachments.id, attachmentId),
          or(
            inArray(attachments.scanStatus, ['QUARANTINED', 'PENDING']),
            and(
              eq(attachments.scanStatus, 'SCANNING'),
              lt(attachments.scannedAt, new Date(now.getTime() - STALE_SCAN_MS)),
            ),
          ),
        ),
      )
      .returning();
    if (!attachment) {
      const [current] = await this.drizzle.db
        .select({ scanStatus: attachments.scanStatus })
        .from(attachments)
        .where(eq(attachments.id, attachmentId))
        .limit(1);
      if (current?.scanStatus === 'SCANNING') throw new Error('SCAN_LEASE_ACTIVE');
      return;
    }

    try {
      const buffer = await this.storage.readQuarantine(attachment.objectKey);
      let inspected;
      try {
        inspected = await this.inspector.inspect(buffer);
      } catch {
        await this.reject(attachment, 'CONTENT_REJECTED');
        return;
      }
      const [integration] = attachment.supportIntegrationId
        ? await this.drizzle.db
            .select({ routingPolicy: supportIntegrations.routingPolicy })
            .from(supportIntegrations)
            .where(eq(supportIntegrations.id, attachment.supportIntegrationId))
            .limit(1)
        : [];
      const allowed = stringArray(integration?.routingPolicy['allowedAttachmentMimeTypes']);
      if (allowed.length > 0 && !allowed.includes(inspected.mimeType)) {
        await this.reject(attachment, 'CONTENT_TYPE_NOT_ALLOWED');
        return;
      }
      const scan = await this.antivirus.scan(buffer);
      if (!scan.clean) {
        await this.storage.deleteQuarantine(attachment.objectKey);
        await this.drizzle.db
          .update(attachments)
          .set({
            scanStatus: 'INFECTED',
            scannedAt: new Date(),
            scanError: `MALWARE:${scan.signature}`,
          })
          .where(eq(attachments.id, attachment.id));
        this.emitRefresh(attachment);
        return;
      }
      const cleanKey = attachment.objectKey.replace(/^quarantine\//, 'clean/');
      await this.storage.promote(attachment.objectKey, cleanKey);
      try {
        await this.drizzle.db
          .update(attachments)
          .set({
            objectKey: cleanKey,
            mimeType: inspected.mimeType,
            originalFilename: canonicalFilename(attachment.originalFilename, inspected.extension),
            scanStatus: 'CLEAN',
            scannedAt: new Date(),
            scanError: null,
          })
          .where(eq(attachments.id, attachment.id));
        try {
          await this.storage.deleteQuarantine(attachment.objectKey);
          await this.drizzle.db
            .update(attachments)
            .set({ quarantineDeletedAt: new Date() })
            .where(eq(attachments.id, attachment.id));
        } catch (error: unknown) {
          this.logger.error(`Quarantaine à purger: ${attachment.id} (${errorCategory(error)})`);
          await this.drizzle.db
            .update(attachments)
            .set({ scanError: 'QUARANTINE_DELETE_FAILED' })
            .where(eq(attachments.id, attachment.id));
        }
        this.emitRefresh(attachment);
      } catch (error: unknown) {
        await this.storage.delete(cleanKey);
        throw error;
      }
    } catch (error: unknown) {
      await this.drizzle.db
        .update(attachments)
        .set({
          scanStatus: finalAttempt ? 'ERROR' : 'QUARANTINED',
          scannedAt: new Date(),
          scanError: errorCategory(error),
        })
        .where(eq(attachments.id, attachment.id));
      if (finalAttempt) this.emitRefresh(attachment);
      this.logger.warn(`Scan pièce jointe différé: ${attachment.id} (${errorCategory(error)})`);
      throw error;
    }
  }

  private emitRefresh(attachment: typeof attachments.$inferSelect): void {
    if (attachment.supportIntegrationId && attachment.externalRequesterId) {
      this.realtime.emitRefresh(
        attachment.supportIntegrationId,
        attachment.externalRequesterId,
        'attachment',
        attachment.id,
      );
    }
  }

  private async reject(attachment: typeof attachments.$inferSelect, reason: string): Promise<void> {
    await this.storage.deleteQuarantine(attachment.objectKey);
    await this.drizzle.db
      .update(attachments)
      .set({
        scanStatus: 'ERROR',
        scannedAt: new Date(),
        scanError: reason,
      })
      .where(eq(attachments.id, attachment.id));
    this.emitRefresh(attachment);
  }
}

function canonicalFilename(original: string, extension: string): string {
  const stem = original.replace(/\.[^.]*$/, '').replace(/[^a-zA-Z0-9_-]/g, '_') || 'attachment';
  return `${stem}.${extension}`;
}
