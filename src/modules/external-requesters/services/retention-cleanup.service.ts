import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { and, eq, inArray, isNull, lt, lte } from 'drizzle-orm';
import { PublicSupportConfigService } from '../../../config/public-support.config';
import { DrizzleProvider } from '../../../database/drizzle.provider';
import {
  externalRequesters,
  externalVerificationChallenges,
  idempotencyRecords,
  tickets,
} from '../../../database/schemas';
import { ExternalRequestersAdminService } from './external-requesters-admin.service';

const CHALLENGE_RETENTION_HOURS = 24;
const IDEMPOTENCY_RETENTION_DAYS = 30;
const OPEN_STATUSES = [
  'NEW',
  'ASSIGNED',
  'IN_PROGRESS',
  'PENDING_CUSTOMER',
  'PENDING_THIRD_PARTY',
  'REOPENED',
] as const;

/**
 * Rétention automatique : anonymise les demandeurs inactifs au-delà de la durée
 * configurée (aucun ticket ouvert) et purge les challenges OTP expirés ainsi
 * que les enregistrements d'idempotence obsolètes. Chaque anonymisation est audité
 * avec un acteur SYSTÈME dédié.
 */
@Injectable()
export class RetentionCleanupService {
  private readonly logger = new Logger(RetentionCleanupService.name);

  constructor(
    private readonly drizzle: DrizzleProvider,
    private readonly config: PublicSupportConfigService,
    private readonly requesters: ExternalRequestersAdminService,
  ) {}

  @Cron('0 4 * * *')
  async runRetention(): Promise<void> {
    const now = new Date();
    const inactiveCutoff = new Date(now.getTime() - this.config.retentionInactiveDays * 86_400_000);
    let anonymized = 0;

    const candidates = await this.drizzle.db
      .select({
        id: externalRequesters.id,
        supportIntegrationId: externalRequesters.supportIntegrationId,
        lastSeenAt: externalRequesters.lastSeenAt,
        createdAt: externalRequesters.createdAt,
      })
      .from(externalRequesters)
      .where(
        and(
          isNull(externalRequesters.anonymizedAt),
          lt(externalRequesters.lastSeenAt ?? externalRequesters.createdAt, inactiveCutoff),
        ),
      )
      .limit(100);

    for (const candidate of candidates) {
      const [open] = await this.drizzle.db
        .select({ id: tickets.id })
        .from(tickets)
        .where(
          and(
            eq(tickets.requesterId, candidate.id),
            eq(tickets.supportIntegrationId, candidate.supportIntegrationId),
            inArray(tickets.status, [...OPEN_STATUSES]),
          ),
        )
        .limit(1);
      if (open) continue;
      await this.requesters.anonymizeByRetention(candidate.id);
      anonymized += 1;
    }

    const challengeCutoff = new Date(now.getTime() - CHALLENGE_RETENTION_HOURS * 3_600_000);
    const challenges = await this.drizzle.db
      .delete(externalVerificationChallenges)
      .where(
        and(
          inArray(externalVerificationChallenges.status, ['EXPIRED', 'LOCKED']),
          lt(externalVerificationChallenges.createdAt, challengeCutoff),
        ),
      )
      .returning({ id: externalVerificationChallenges.id });

    const idempotencyCutoff = new Date(now.getTime() - IDEMPOTENCY_RETENTION_DAYS * 86_400_000);
    const idempotency = await this.drizzle.db
      .delete(idempotencyRecords)
      .where(lte(idempotencyRecords.createdAt, idempotencyCutoff))
      .returning({ keyHash: idempotencyRecords.keyHash });

    if (anonymized > 0 || challenges.length > 0 || idempotency.length > 0) {
      this.logger.log(
        `Rétention : ${anonymized} demandeur(s) anonymisé(s), ${challenges.length} challenge(s) purgé(s), ${idempotency.length} idempotence(s) purgée(s).`,
      );
    }
  }
}
