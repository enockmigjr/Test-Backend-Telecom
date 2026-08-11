import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, isNull, lt, or, sql } from 'drizzle-orm';
import { normalizePagination } from '../../../common/helpers/normalized-pagination.helper';
import { PaginationHelper } from '../../../common/helpers/pagination.helper';
import { generateUuid } from '../../../common/helpers/uuidv7.helper';
import { DrizzleProvider } from '../../../database/drizzle.provider';
import { externalDeliveries, externalIdentities, outboxEvents, tickets } from '../../../database/schemas';
import { IntegrationSecretCipherService } from '../../support-integrations/services/integration-secret-cipher.service';
import { ExternalDeliveryQueryDto } from '../dto/external-delivery-query.dto';
import { ChannelAdapter, EMAIL_CHANNEL_ADAPTER } from '../interfaces/channel-adapter.interface';

const DELIVERY_LEASE_MS = 60_000;
const MAX_ATTEMPTS = 5;
const OUTBOUND_EVENTS = new Set([
  'PUBLIC_TICKET_CREATED',
  'PUBLIC_REPLY_CREATED',
  'PUBLIC_REPLY_CORRECTED',
  'PUBLIC_INFORMATION_REQUESTED',
  'PUBLIC_STATUS_CHANGED',
  'PUBLIC_TICKET_RESOLVED',
  'PUBLIC_TICKET_CLOSED',
  'PUBLIC_TICKET_REOPENED',
  'PUBLIC_HUMAN_HANDOFF_REQUESTED',
]);

@Injectable()
export class ExternalDeliveryService {
  constructor(
    private readonly drizzle: DrizzleProvider,
    private readonly cipher: IntegrationSecretCipherService,
    @Inject(EMAIL_CHANNEL_ADAPTER) private readonly email: ChannelAdapter,
  ) {}

  async dispatch(outboxEventId: string, workerId: string): Promise<void> {
    const target = await this.loadTarget(outboxEventId);
    if (!target || !OUTBOUND_EVENTS.has(target.eventType)) return;
    const delivery = await this.ensureDelivery(target.eventId, target.integrationId, target.destinationKey);
    if (delivery.status === 'DELIVERED' || delivery.status === 'DELIVERY_UNKNOWN' || delivery.status === 'FAILED')
      return;
    const now = new Date();
    if (delivery.status === 'PROCESSING') {
      if (delivery.lockedAt && delivery.lockedAt.getTime() > now.getTime() - DELIVERY_LEASE_MS) {
        throw new Error('DELIVERY_LEASE_ACTIVE');
      }
      await this.drizzle.db
        .update(externalDeliveries)
        .set({
          status: 'DELIVERY_UNKNOWN',
          lockedAt: null,
          lockedBy: null,
          lastError: 'PROVIDER_RESULT_AMBIGUOUS',
        })
        .where(
          and(
            eq(externalDeliveries.id, delivery.id),
            eq(externalDeliveries.status, 'PROCESSING'),
            delivery.lockedAt
              ? eq(externalDeliveries.lockedAt, delivery.lockedAt)
              : isNull(externalDeliveries.lockedAt),
            delivery.lockedBy
              ? eq(externalDeliveries.lockedBy, delivery.lockedBy)
              : isNull(externalDeliveries.lockedBy),
          ),
        );
      return;
    }

    const [claimed] = await this.drizzle.db
      .update(externalDeliveries)
      .set({
        status: 'PROCESSING',
        lockedAt: now,
        lockedBy: workerId,
      })
      .where(
        and(
          eq(externalDeliveries.id, delivery.id),
          or(
            eq(externalDeliveries.status, 'PENDING'),
            and(
              eq(externalDeliveries.status, 'PROCESSING'),
              lt(externalDeliveries.lockedAt, new Date(now.getTime() - DELIVERY_LEASE_MS)),
            ),
          ),
        ),
      )
      .returning();
    if (!claimed) return;

    try {
      const result = await this.email.deliver({
        deliveryId: delivery.id,
        destination: target.destination,
        eventType: target.eventType,
        ...(target.ticketNumber ? { ticketNumber: target.ticketNumber } : {}),
      });
      await this.drizzle.db
        .update(externalDeliveries)
        .set({
          status: 'DELIVERED',
          deliveredAt: new Date(),
          lockedAt: null,
          lockedBy: null,
          providerMessageId: result.providerMessageId ?? null,
          lastError: null,
        })
        .where(and(eq(externalDeliveries.id, delivery.id), eq(externalDeliveries.lockedBy, workerId)));
    } catch (error: unknown) {
      const attempts = claimed.attemptCount + 1;
      await this.drizzle.db
        .update(externalDeliveries)
        .set({
          status: attempts >= MAX_ATTEMPTS ? 'FAILED' : 'PENDING',
          attemptCount: attempts,
          lockedAt: null,
          lockedBy: null,
          lastError: errorCategory(error),
        })
        .where(and(eq(externalDeliveries.id, delivery.id), eq(externalDeliveries.lockedBy, workerId)));
      throw error;
    }
  }

  private async loadTarget(eventId: string) {
    const [row] = await this.drizzle.db
      .select({
        eventId: outboxEvents.id,
        eventType: outboxEvents.eventType,
        integrationId: outboxEvents.supportIntegrationId,
        encryptedValue: externalIdentities.encryptedValue,
        destinationKey: externalIdentities.normalizedValueHash,
        identityId: externalIdentities.id,
        ticketNumber: tickets.ticketNumber,
      })
      .from(outboxEvents)
      .leftJoin(tickets, eq(outboxEvents.aggregateId, tickets.id))
      .innerJoin(
        externalIdentities,
        and(
          sql`${externalIdentities.externalRequesterId} = COALESCE(${outboxEvents.externalRequesterId}, ${tickets.requesterId})`,
          eq(outboxEvents.supportIntegrationId, externalIdentities.supportIntegrationId),
          eq(externalIdentities.identityType, 'EMAIL'),
          isNull(externalIdentities.revokedAt),
        ),
      )
      .where(eq(outboxEvents.id, eventId))
      .limit(1);
    if (!row?.integrationId || !row.eventType.startsWith('PUBLIC_')) return undefined;
    const [keyVersion, encrypted] = splitEncrypted(row.encryptedValue);
    return {
      ...row,
      integrationId: row.integrationId,
      destination: this.cipher.open(encrypted, keyVersion, `identity:${row.identityId}`),
    };
  }

  private async ensureDelivery(eventId: string, integrationId: string, destinationKey: string) {
    await this.drizzle.db
      .insert(externalDeliveries)
      .values({
        id: generateUuid(),
        outboxEventId: eventId,
        supportIntegrationId: integrationId,
        channel: 'EMAIL',
        destinationKey,
      })
      .onConflictDoNothing();
    const [delivery] = await this.drizzle.db
      .select()
      .from(externalDeliveries)
      .where(
        and(
          eq(externalDeliveries.outboxEventId, eventId),
          eq(externalDeliveries.channel, 'EMAIL'),
          eq(externalDeliveries.destinationKey, destinationKey),
        ),
      )
      .limit(1);
    if (!delivery) throw new Error('DELIVERY_NOT_PERSISTED');
    return delivery;
  }

  async adminList(query: ExternalDeliveryQueryDto) {
    const { page, limit } = normalizePagination(query.page, query.limit);
    const conditions = [
      query.supportIntegrationId ? eq(externalDeliveries.supportIntegrationId, query.supportIntegrationId) : undefined,
      query.channel ? eq(externalDeliveries.channel, query.channel) : undefined,
      query.status ? eq(externalDeliveries.status, query.status) : undefined,
    ].filter((condition): condition is NonNullable<typeof condition> => Boolean(condition));
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const [count, rows] = await Promise.all([
      this.drizzle.db
        .select({ count: sql<number>`count(*)` })
        .from(externalDeliveries)
        .where(where),
      this.drizzle.db
        .select()
        .from(externalDeliveries)
        .where(where)
        .orderBy(desc(externalDeliveries.createdAt))
        .limit(limit)
        .offset(PaginationHelper.getOffset(page, limit)),
    ]);
    return PaginationHelper.paginate(rows, Number(count[0]?.count ?? 0), page, limit);
  }

  async adminFindOne(id: string) {
    const [delivery] = await this.drizzle.db
      .select()
      .from(externalDeliveries)
      .where(eq(externalDeliveries.id, id))
      .limit(1);
    if (!delivery) throw new NotFoundException('Livraison externe introuvable.');
    return { data: delivery };
  }
}

function splitEncrypted(value: string): readonly [number, string] {
  const separator = value.indexOf(':');
  const version = Number(value.slice(0, separator));
  const encrypted = value.slice(separator + 1);
  if (!Number.isSafeInteger(version) || version < 1 || !encrypted) throw new Error('IDENTITY_CIPHERTEXT_INVALID');
  return [version, encrypted];
}

function errorCategory(error: unknown): string {
  if (typeof error !== 'object' || error === null) return 'UnknownError';
  const name = 'name' in error && typeof error.name === 'string' ? error.name : 'Error';
  const code = 'code' in error && typeof error.code === 'string' ? error.code : undefined;
  return code ? `${name}:${code}` : name;
}
