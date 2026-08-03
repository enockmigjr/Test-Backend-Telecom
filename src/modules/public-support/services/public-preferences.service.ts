import { Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DrizzleProvider } from '../../../database/drizzle.provider';
import { externalRequesters, outboxEvents } from '../../../database/schemas';
import { generateUuid } from '../../../common/helpers/uuidv7.helper';
import { PublicPrincipal } from '../../external-identity/interfaces/public-principal.interface';
import { UpdatePublicPreferencesDto } from '../dto/public-ticket.dto';

@Injectable()
export class PublicPreferencesService {
  constructor(private readonly drizzle: DrizzleProvider) {}

  async get(principal: PublicPrincipal) {
    const [profile] = await this.drizzle.db
      .select({
        displayName: externalRequesters.displayName,
        locale: externalRequesters.locale,
        lastSeenAt: externalRequesters.lastSeenAt,
      })
      .from(externalRequesters)
      .where(
        and(
          eq(externalRequesters.id, principal.externalRequesterId),
          eq(externalRequesters.supportIntegrationId, principal.supportIntegrationId),
        ),
      )
      .limit(1);
    return { data: profile };
  }

  async update(principal: PublicPrincipal, dto: UpdatePublicPreferencesDto) {
    return this.drizzle.runInTransaction(async () => {
      const [profile] = await this.drizzle.db
        .update(externalRequesters)
        .set({
          ...(dto.displayName === undefined ? {} : { displayName: dto.displayName.trim() || null }),
          ...(dto.locale === undefined ? {} : { locale: dto.locale.trim() || 'fr' }),
          lastSeenAt: new Date(),
        })
        .where(
          and(
            eq(externalRequesters.id, principal.externalRequesterId),
            eq(externalRequesters.supportIntegrationId, principal.supportIntegrationId),
          ),
        )
        .returning({ displayName: externalRequesters.displayName, locale: externalRequesters.locale });
      const mutationId = generateUuid();
      await this.drizzle.db.insert(outboxEvents).values({
        id: generateUuid(),
        mutationId,
        schemaVersion: 1,
        supportIntegrationId: principal.supportIntegrationId,
        actorType: 'EXTERNAL_REQUESTER',
        externalRequesterId: principal.externalRequesterId,
        aggregateType: 'EXTERNAL_REQUESTER',
        aggregateId: principal.externalRequesterId,
        eventType: 'PUBLIC_PREFERENCES_UPDATED',
        deduplicationKey: `public-preferences-updated:${mutationId}`,
        payload: { changedFields: Object.keys(dto).sort() },
      });
      return { data: profile };
    });
  }
}
