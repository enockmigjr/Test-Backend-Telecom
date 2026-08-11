import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { and, count, desc, eq, ilike, isNotNull, isNull, type SQL } from 'drizzle-orm';
import type { AnyPgTable } from 'drizzle-orm/pg-core';
import { normalizePagination } from '../../../common/helpers/normalized-pagination.helper';
import { PaginationHelper } from '../../../common/helpers/pagination.helper';
import { DrizzleProvider } from '../../../database/drizzle.provider';
import {
  attachments,
  auditLogs,
  externalVerificationChallenges,
  externalIdentities,
  externalRequesters,
  idempotencyRecords,
  outboxEvents,
  publicBootstrapGrants,
  supportConversations,
  supportMessages,
  tickets,
  ticketComments,
  ticketHistory,
  trustedDevices,
} from '../../../database/schemas';
import { AuditLogsService } from '../../audit-logs/audit-logs.service';
import { ExternalRequesterQueryDto } from '../dto/external-requester-query.dto';
import { MergeRequesterDto } from '../dto/merge-requester.dto';

@Injectable()
export class ExternalRequestersAdminService {
  constructor(
    private readonly drizzle: DrizzleProvider,
    private readonly audit: AuditLogsService,
  ) {}

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

  async mergePreview(id: string) {
    const requester = await this.requireRequester(id);
    return { data: await this.buildImpact(requester.id, requester.supportIntegrationId) };
  }

  async merge(id: string, dto: MergeRequesterDto, userId: string) {
    const source = await this.requireRequester(id);
    const [target] = await this.drizzle.db
      .select()
      .from(externalRequesters)
      .where(
        and(
          eq(externalRequesters.id, dto.targetRequesterId),
          eq(externalRequesters.supportIntegrationId, source.supportIntegrationId),
        ),
      )
      .limit(1);
    if (!target) throw new NotFoundException('Profil cible introuvable dans cette intégration.');
    if (target.id === source.id) throw new BadRequestException('Impossible de fusionner un profil avec lui-même.');
    if (source.anonymizedAt || target.anonymizedAt)
      throw new BadRequestException('Fusion refusée : un profil anonymisé ne peut pas être fusionné.');

    return this.drizzle.runInTransaction(async () => {
      const impact = await this.buildImpact(source.id, source.supportIntegrationId);
      const integrationId = source.supportIntegrationId;

      await this.drizzle.db
        .update(tickets)
        .set({ requesterId: target.id })
        .where(eq(tickets.requesterId, source.id));
      await this.drizzle.db
        .update(supportConversations)
        .set({ externalRequesterId: target.id })
        .where(eq(supportConversations.externalRequesterId, source.id));
      await this.drizzle.db
        .update(supportMessages)
        .set({ externalRequesterId: target.id })
        .where(eq(supportMessages.externalRequesterId, source.id));
      await this.drizzle.db
        .update(ticketComments)
        .set({ externalRequesterId: target.id })
        .where(eq(ticketComments.externalRequesterId, source.id));
      await this.drizzle.db
        .update(ticketHistory)
        .set({ externalRequesterId: target.id })
        .where(eq(ticketHistory.externalRequesterId, source.id));
      await this.drizzle.db
        .update(trustedDevices)
        .set({ externalRequesterId: target.id })
        .where(eq(trustedDevices.externalRequesterId, source.id));
      await this.drizzle.db
        .update(externalVerificationChallenges)
        .set({ externalRequesterId: target.id })
        .where(eq(externalVerificationChallenges.externalRequesterId, source.id));
      await this.drizzle.db
        .update(outboxEvents)
        .set({ externalRequesterId: target.id })
        .where(eq(outboxEvents.externalRequesterId, source.id));
      await this.drizzle.db
        .update(publicBootstrapGrants)
        .set({ externalRequesterId: target.id })
        .where(eq(publicBootstrapGrants.externalRequesterId, source.id));
      await this.drizzle.db
        .update(attachments)
        .set({ externalRequesterId: target.id })
        .where(eq(attachments.externalRequesterId, source.id));

      const [sourceIdentities, targetIdentities] = await Promise.all([
        this.drizzle.db
          .select({ id: externalIdentities.id, identityType: externalIdentities.identityType, normalizedValueHash: externalIdentities.normalizedValueHash })
          .from(externalIdentities)
          .where(eq(externalIdentities.externalRequesterId, source.id)),
        this.drizzle.db
          .select({ identityType: externalIdentities.identityType, normalizedValueHash: externalIdentities.normalizedValueHash })
          .from(externalIdentities)
          .where(
            and(
              eq(externalIdentities.externalRequesterId, target.id),
              eq(externalIdentities.supportIntegrationId, integrationId),
            ),
          ),
      ]);
      const targetKeys = new Set(targetIdentities.map((identity) => `${identity.identityType}:${identity.normalizedValueHash}`));
      let collisionsRemoved = 0;
      for (const identity of sourceIdentities) {
        if (targetKeys.has(`${identity.identityType}:${identity.normalizedValueHash}`)) {
          await this.drizzle.db.delete(externalIdentities).where(eq(externalIdentities.id, identity.id));
          collisionsRemoved += 1;
        } else {
          await this.drizzle.db
            .update(externalIdentities)
            .set({ externalRequesterId: target.id })
            .where(eq(externalIdentities.id, identity.id));
        }
      }

      const displayNameAdopted = !target.displayName && source.displayName ? source.displayName : null;
      await this.drizzle.db
        .update(externalRequesters)
        .set({
          ...(displayNameAdopted ? { displayName: displayNameAdopted } : {}),
          ...(!target.locale || target.locale === 'fr' ? { locale: source.locale ?? target.locale ?? 'fr' } : {}),
          updatedAt: new Date(),
        })
        .where(eq(externalRequesters.id, target.id));
      await this.drizzle.db
        .update(externalRequesters)
        .set({
          metadata: {
            ...source.metadata,
            mergedIntoRequesterId: target.id,
            mergedAt: new Date().toISOString(),
          },
          updatedAt: new Date(),
        })
        .where(eq(externalRequesters.id, source.id));

      await this.audit.create(
        userId,
        'EXTERNAL_REQUESTER_MERGED',
        'external_requester',
        source.id,
        { requesterId: source.id, targetRequesterId: target.id },
        {
          moved: impact.moved,
          identityCollisionsRemoved: collisionsRemoved,
          displayNameAdopted,
          kept: impact.kept,
        },
      );

      return {
        data: {
          merged: true,
          targetRequesterId: target.id,
          moved: impact.moved,
          identityCollisionsRemoved: collisionsRemoved,
          displayNameAdopted,
        },
      };
    });
  }

  private async requireRequester(id: string) {
    const [requester] = await this.drizzle.db
      .select()
      .from(externalRequesters)
      .where(eq(externalRequesters.id, id))
      .limit(1);
    if (!requester) throw new NotFoundException('Demandeur externe introuvable.');
    return requester;
  }

  private async buildImpact(requesterId: string, integrationId: string) {
    const conditions = and(
      eq(externalIdentities.externalRequesterId, requesterId),
      eq(externalIdentities.supportIntegrationId, integrationId),
    );
    const [
      ticketsCount,
      conversationsCount,
      messagesCount,
      commentsCount,
      historyCount,
      devicesCount,
      challengesCount,
      outboxCount,
      grantsCount,
      attachmentsCount,
      identitiesCount,
      auditCount,
      idempotencyCount,
      identities,
    ] = await Promise.all([
      this.countWhere(tickets, eq(tickets.requesterId, requesterId), eq(tickets.supportIntegrationId, integrationId)),
      this.countWhere(supportConversations, eq(supportConversations.externalRequesterId, requesterId), eq(supportConversations.supportIntegrationId, integrationId)),
      this.countWhere(supportMessages, eq(supportMessages.externalRequesterId, requesterId), eq(supportMessages.supportIntegrationId, integrationId)),
      this.countWhere(ticketComments, eq(ticketComments.externalRequesterId, requesterId), eq(ticketComments.supportIntegrationId, integrationId)),
      this.countWhere(ticketHistory, eq(ticketHistory.externalRequesterId, requesterId), eq(ticketHistory.supportIntegrationId, integrationId)),
      this.countWhere(trustedDevices, eq(trustedDevices.externalRequesterId, requesterId), eq(trustedDevices.supportIntegrationId, integrationId)),
      this.countWhere(externalVerificationChallenges, eq(externalVerificationChallenges.externalRequesterId, requesterId), eq(externalVerificationChallenges.supportIntegrationId, integrationId)),
      this.countWhere(outboxEvents, eq(outboxEvents.externalRequesterId, requesterId), eq(outboxEvents.supportIntegrationId, integrationId)),
      this.countWhere(publicBootstrapGrants, eq(publicBootstrapGrants.externalRequesterId, requesterId), eq(publicBootstrapGrants.supportIntegrationId, integrationId)),
      this.countWhere(attachments, eq(attachments.externalRequesterId, requesterId), eq(attachments.supportIntegrationId, integrationId)),
      this.countWhere(externalIdentities, conditions),
      this.countWhere(auditLogs, eq(auditLogs.externalRequesterId, requesterId), eq(auditLogs.supportIntegrationId, integrationId)),
      this.countWhere(idempotencyRecords, eq(idempotencyRecords.externalRequesterId, requesterId), eq(idempotencyRecords.supportIntegrationId, integrationId)),
      this.drizzle.db
        .select({
          identityType: externalIdentities.identityType,
          verifiedAt: externalIdentities.verifiedAt,
          revokedAt: externalIdentities.revokedAt,
        })
        .from(externalIdentities)
        .where(conditions)
        .orderBy(desc(externalIdentities.verifiedAt)),
    ]);
    return {
      requesterId,
      moved: {
        tickets: ticketsCount,
        conversations: conversationsCount,
        messages: messagesCount,
        comments: commentsCount,
        history: historyCount,
        trustedDevices: devicesCount,
        identities: identitiesCount,
        verificationChallenges: challengesCount,
        outboxEvents: outboxCount,
        bootstrapGrants: grantsCount,
        attachments: attachmentsCount,
      },
      identities,
      kept: {
        auditEntries: auditCount,
        idempotencyRecords: idempotencyCount,
      },
    };
  }

  private async countWhere(table: AnyPgTable, ...conditions: readonly (SQL | undefined)[]) {
    const [row] = await this.drizzle.db
      .select({ total: count() })
      .from(table)
      .where(and(...conditions.filter((condition): condition is NonNullable<typeof condition> => Boolean(condition))));
    return Number(row?.total ?? 0);
  }
}
