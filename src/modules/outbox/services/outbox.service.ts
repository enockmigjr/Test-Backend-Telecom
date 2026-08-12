import { Injectable } from '@nestjs/common';
import { and, asc, eq, inArray, lt, lte, or } from 'drizzle-orm';
import { DrizzleProvider } from '../../../database/drizzle.provider';
import { outboxEvents, OutboxEvent } from '../../../database/schemas';
import { errorCategory } from '../../../common/utils/helpers';

const LEASE_MS = 60_000;

@Injectable()
export class OutboxService {
  constructor(private readonly drizzle: DrizzleProvider) {}

  async claim(workerId: string, limit = 25): Promise<OutboxEvent[]> {
    const now = new Date();
    const staleBefore = new Date(now.getTime() - LEASE_MS);
    return this.drizzle.runInTransaction(async () => {
      const candidates = await this.drizzle.db
        .select()
        .from(outboxEvents)
        .where(
          and(
            or(
              and(eq(outboxEvents.status, 'PENDING'), lte(outboxEvents.availableAt, now)),
              and(eq(outboxEvents.status, 'PROCESSING'), lt(outboxEvents.lockedAt, staleBefore)),
            ),
            lt(outboxEvents.attemptCount, outboxEvents.maxAttempts),
          ),
        )
        .orderBy(asc(outboxEvents.createdAt))
        .limit(Math.min(Math.max(limit, 1), 100))
        .for('update', { skipLocked: true });
      if (candidates.length === 0) return [];
      const ids = candidates.map((event) => event.id);
      return this.drizzle.db
        .update(outboxEvents)
        .set({
          status: 'PROCESSING',
          lockedAt: now,
          lockedBy: workerId,
        })
        .where(inArray(outboxEvents.id, ids))
        .returning();
    });
  }

  async published(id: string, workerId: string): Promise<void> {
    await this.drizzle.db
      .update(outboxEvents)
      .set({
        status: 'PUBLISHED',
        publishedAt: new Date(),
        lockedAt: null,
        lockedBy: null,
        lastError: null,
      })
      .where(and(eq(outboxEvents.id, id), eq(outboxEvents.status, 'PROCESSING'), eq(outboxEvents.lockedBy, workerId)));
  }

  async failed(event: OutboxEvent, workerId: string, error: unknown): Promise<void> {
    const attemptCount = event.attemptCount + 1;
    const exhausted = attemptCount >= event.maxAttempts;
    const delaySeconds = Math.min(300, 2 ** Math.min(attemptCount, 8));
    await this.drizzle.db
      .update(outboxEvents)
      .set({
        status: exhausted ? 'FAILED' : 'PENDING',
        attemptCount,
        availableAt: new Date(Date.now() + delaySeconds * 1000),
        failedAt: exhausted ? new Date() : null,
        lockedAt: null,
        lockedBy: null,
        lastError: errorCategory(error),
      })
      .where(
        and(eq(outboxEvents.id, event.id), eq(outboxEvents.status, 'PROCESSING'), eq(outboxEvents.lockedBy, workerId)),
      );
  }
}
