import { Injectable, NotFoundException } from '@nestjs/common';
import { and, count, desc, eq, ilike, isNotNull, isNull } from 'drizzle-orm';
import { normalizePagination } from '../../../common/helpers/normalized-pagination.helper';
import { PaginationHelper } from '../../../common/helpers/pagination.helper';
import { DrizzleProvider } from '../../../database/drizzle.provider';
import {
  externalIdentities,
  externalRequesters,
  supportConversations,
  tickets,
  trustedDevices,
} from '../../../database/schemas';
import { ExternalRequesterQueryDto } from '../dto/external-requester-query.dto';

@Injectable()
export class ExternalRequestersAdminService {
  constructor(private readonly drizzle: DrizzleProvider) {}

  async list(query: ExternalRequesterQueryDto) {
    const { page, limit } = normalizePagination(query.page, query.limit);
    const conditions = [
      query.supportIntegrationId ? eq(externalRequesters.supportIntegrationId, query.supportIntegrationId) : undefined,
      query.search ? ilike(externalRequesters.displayName, `%${query.search}%`) : undefined,
      query.anonymized === 'true'
        ? isNotNull(externalRequesters.anonymizedAt)
        : query.anonymized === 'false'
          ? isNull(externalRequesters.anonymizedAt)
          : undefined,
    ].filter((condition): condition is NonNullable<typeof condition> => Boolean(condition));
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const [total, rows] = await Promise.all([
      this.drizzle.db.select({ total: count() }).from(externalRequesters).where(where),
      this.drizzle.db
        .select()
        .from(externalRequesters)
        .where(where)
        .orderBy(desc(externalRequesters.createdAt))
        .limit(limit)
        .offset(PaginationHelper.getOffset(page, limit)),
    ]);
    return PaginationHelper.paginate(rows, Number(total[0]?.total ?? 0), page, limit);
  }

  async detail(id: string) {
    const [requester] = await this.drizzle.db
      .select()
      .from(externalRequesters)
      .where(eq(externalRequesters.id, id))
      .limit(1);
    if (!requester) throw new NotFoundException('Demandeur externe introuvable.');
    const [ticketCount, conversationCount, deviceCount, identities] = await Promise.all([
      this.drizzle.db
        .select({ total: count() })
        .from(tickets)
        .where(and(eq(tickets.requesterId, id), eq(tickets.supportIntegrationId, requester.supportIntegrationId))),
      this.drizzle.db
        .select({ total: count() })
        .from(supportConversations)
        .where(
          and(
            eq(supportConversations.externalRequesterId, id),
            eq(supportConversations.supportIntegrationId, requester.supportIntegrationId),
          ),
        ),
      this.drizzle.db
        .select({ total: count() })
        .from(trustedDevices)
        .where(
          and(
            eq(trustedDevices.externalRequesterId, id),
            eq(trustedDevices.supportIntegrationId, requester.supportIntegrationId),
          ),
        ),
      this.drizzle.db
        .select({
          identityType: externalIdentities.identityType,
          verifiedAt: externalIdentities.verifiedAt,
          revokedAt: externalIdentities.revokedAt,
        })
        .from(externalIdentities)
        .where(
          and(
            eq(externalIdentities.externalRequesterId, id),
            eq(externalIdentities.supportIntegrationId, requester.supportIntegrationId),
          ),
        )
        .orderBy(desc(externalIdentities.verifiedAt)),
    ]);
    return {
      data: {
        ...requester,
        summary: {
          tickets: Number(ticketCount[0]?.total ?? 0),
          conversations: Number(conversationCount[0]?.total ?? 0),
          trustedDevices: Number(deviceCount[0]?.total ?? 0),
          identities,
        },
      },
    };
  }
}
