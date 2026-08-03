import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { and, asc, eq, inArray, isNull, like, lt } from 'drizzle-orm';
import { DrizzleProvider } from '../../../database/drizzle.provider';
import { attachments } from '../../../database/schemas';
import { outboxEvents } from '../../../database/schemas';
import { generateUuid } from '../../../common/helpers/uuidv7.helper';
import { LocalStorageService } from '../storage/local-storage.service';

@Injectable()
export class AttachmentQuarantineCleanupService {
  private readonly logger = new Logger(AttachmentQuarantineCleanupService.name);
  private readonly retentionMs = Number(process.env['ATTACHMENT_QUARANTINE_RETENTION_HOURS'] || 24) * 60 * 60_000;

  constructor(
    private readonly drizzle: DrizzleProvider,
    private readonly storage: LocalStorageService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async cleanup(): Promise<void> {
    const incomingDeleted = await this.storage.cleanupIncoming(new Date(Date.now() - this.retentionMs));
    const expired = await this.drizzle.db
      .select()
      .from(attachments)
      .where(
        and(
          inArray(attachments.scanStatus, ['QUARANTINED', 'ERROR']),
          lt(attachments.createdAt, new Date(Date.now() - this.retentionMs)),
        ),
      )
      .orderBy(asc(attachments.createdAt))
      .limit(100);
    for (const attachment of expired) {
      const [claimed] = await this.drizzle.db
        .update(attachments)
        .set({
          scanStatus: 'ERROR',
          scannedAt: new Date(),
          scanError: 'QUARANTINE_EXPIRED',
        })
        .where(
          and(
            eq(attachments.id, attachment.id),
            eq(attachments.scanStatus, attachment.scanStatus),
            lt(attachments.createdAt, new Date(Date.now() - this.retentionMs)),
          ),
        )
        .returning({ id: attachments.id });
      if (!claimed) continue;
      await this.storage.deleteQuarantine(attachment.objectKey);
    }
    if (expired.length > 0) this.logger.log(`${expired.length} quarantaine(s) expirée(s) nettoyée(s).`);
    if (incomingDeleted > 0) this.logger.log(`${incomingDeleted} temporaire(s) entrant(s) nettoyé(s).`);
  }

  @Cron('*/5 * * * *')
  async recoverStaleScans(): Promise<void> {
    const staleBefore = new Date(Date.now() - 2 * 60_000);
    const stale = await this.drizzle.db
      .select()
      .from(attachments)
      .where(and(eq(attachments.scanStatus, 'SCANNING'), lt(attachments.scannedAt, staleBefore)))
      .orderBy(asc(attachments.scannedAt))
      .limit(100);
    for (const attachment of stale) {
      await this.drizzle.runInTransaction(async () => {
        const [recovered] = await this.drizzle.db
          .update(attachments)
          .set({
            scanStatus: 'QUARANTINED',
            scanError: 'STALE_SCAN_RECOVERED',
          })
          .where(
            and(
              eq(attachments.id, attachment.id),
              eq(attachments.scanStatus, 'SCANNING'),
              lt(attachments.scannedAt, staleBefore),
            ),
          )
          .returning({ id: attachments.id });
        if (!recovered) return;
        const mutationId = generateUuid();
        await this.drizzle.db.insert(outboxEvents).values({
          id: generateUuid(),
          mutationId,
          schemaVersion: 1,
          supportIntegrationId: attachment.supportIntegrationId,
          actorType: 'SYSTEM',
          aggregateType: 'ATTACHMENT',
          aggregateId: attachment.id,
          eventType: 'PUBLIC_ATTACHMENT_QUARANTINED',
          deduplicationKey: `public-attachment-recovered:${mutationId}`,
          payload: { attachmentId: attachment.id, recovered: true },
        });
      });
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async purgePromotedQuarantines(): Promise<void> {
    const values = await this.drizzle.db
      .select()
      .from(attachments)
      .where(
        and(
          eq(attachments.scanStatus, 'CLEAN'),
          isNull(attachments.quarantineDeletedAt),
          like(attachments.objectKey, 'clean/%'),
        ),
      )
      .limit(100);
    for (const attachment of values) {
      const quarantineKey = attachment.objectKey.replace(/^clean\//, 'quarantine/');
      await this.storage.deleteQuarantine(quarantineKey);
      await this.drizzle.db
        .update(attachments)
        .set({ scanError: null, quarantineDeletedAt: new Date() })
        .where(and(eq(attachments.id, attachment.id), isNull(attachments.quarantineDeletedAt)));
    }
  }
}
