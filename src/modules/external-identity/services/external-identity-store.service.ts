import { Injectable } from '@nestjs/common';
import { and, eq, gt, lt, sql } from 'drizzle-orm';
import { generateUuid } from '../../../common/helpers/uuidv7.helper';
import { DrizzleProvider } from '../../../database/drizzle.provider';
import {
  externalIdentities,
  externalRequesters,
  externalVerificationChallenges,
  ExternalVerificationChallenge,
} from '../../../database/schemas';
import { IntegrationSecretCipherService } from '../../support-integrations/services/integration-secret-cipher.service';
import { VerificationOutcome } from './verification-outcome';
import { splitEncrypted } from '../../../common/utils/helpers';

@Injectable()
export class ExternalIdentityStoreService {
  constructor(
    private readonly drizzle: DrizzleProvider,
    private readonly cipher: IntegrationSecretCipherService,
  ) {}

  async findChallenge(id: string) {
    const [challenge] = await this.drizzle.db
      .select()
      .from(externalVerificationChallenges)
      .where(eq(externalVerificationChallenges.id, id))
      .limit(1);
    return challenge;
  }

  async expireChallenge(id: string): Promise<void> {
    await this.drizzle.db
      .update(externalVerificationChallenges)
      .set({ status: 'EXPIRED' })
      .where(and(eq(externalVerificationChallenges.id, id), eq(externalVerificationChallenges.status, 'PENDING')));
  }

  async recordFailure(id: string): Promise<void> {
    await this.drizzle.db
      .update(externalVerificationChallenges)
      .set({
        attemptCount: sql`${externalVerificationChallenges.attemptCount} + 1`,
        status: sql`CASE WHEN ${externalVerificationChallenges.attemptCount} + 1 >= ${externalVerificationChallenges.maxAttempts}
          THEN 'LOCKED'::verification_challenge_status_enum ELSE ${externalVerificationChallenges.status} END`,
      })
      .where(
        and(
          eq(externalVerificationChallenges.id, id),
          eq(externalVerificationChallenges.status, 'PENDING'),
          lt(externalVerificationChallenges.attemptCount, externalVerificationChallenges.maxAttempts),
        ),
      );
  }

  async consume(challenge: ExternalVerificationChallenge): Promise<VerificationOutcome> {
    return this.drizzle.runInTransaction(async () => {
      const [consumed] = await this.drizzle.db
        .update(externalVerificationChallenges)
        .set({ status: 'VERIFIED', consumedAt: new Date() })
        .where(
          and(
            eq(externalVerificationChallenges.id, challenge.id),
            eq(externalVerificationChallenges.status, 'PENDING'),
            gt(externalVerificationChallenges.expiresAt, new Date()),
            lt(externalVerificationChallenges.attemptCount, externalVerificationChallenges.maxAttempts),
          ),
        )
        .returning({ id: externalVerificationChallenges.id });
      if (!consumed) return { verified: false };
      const requesterId = await this.upsertIdentity(challenge);
      await this.drizzle.db
        .update(externalVerificationChallenges)
        .set({ externalRequesterId: requesterId })
        .where(eq(externalVerificationChallenges.id, challenge.id));
      return { verified: true, requesterId, integrationId: challenge.supportIntegrationId };
    });
  }

  private async upsertIdentity(challenge: ExternalVerificationChallenge): Promise<string> {
    const contact = this.openChallengeDestination(challenge);
    const [existing] = await this.drizzle.db
      .select()
      .from(externalIdentities)
      .where(
        and(
          eq(externalIdentities.supportIntegrationId, challenge.supportIntegrationId),
          eq(externalIdentities.identityType, challenge.identityType),
          eq(externalIdentities.normalizedValueHash, challenge.contactHash),
        ),
      )
      .limit(1);
    if (existing) {
      const encryptedValue = this.sealIdentityValue(existing.id, contact);
      await this.drizzle.db
        .update(externalIdentities)
        .set({ encryptedValue, verifiedAt: new Date(), revokedAt: null })
        .where(eq(externalIdentities.id, existing.id));
      return existing.externalRequesterId;
    }
    const requesterId = generateUuid();
    const identityId = generateUuid();
    await this.drizzle.db.insert(externalRequesters).values({
      id: requesterId,
      supportIntegrationId: challenge.supportIntegrationId,
      lastSeenAt: new Date(),
    });
    await this.drizzle.db.insert(externalIdentities).values({
      id: identityId,
      supportIntegrationId: challenge.supportIntegrationId,
      externalRequesterId: requesterId,
      identityType: challenge.identityType,
      normalizedValueHash: challenge.contactHash,
      encryptedValue: this.sealIdentityValue(identityId, contact),
      verifiedAt: new Date(),
    });
    return requesterId;
  }

  private openChallengeDestination(challenge: ExternalVerificationChallenge): string {
    const [keyVersion, encryptedValue] = splitEncrypted(challenge.encryptedDestination);
    return this.cipher.open(encryptedValue, keyVersion, `verification:${challenge.id}`);
  }

  private sealIdentityValue(identityId: string, value: string): string {
    const sealed = this.cipher.seal(value, `identity:${identityId}`);
    return `${sealed.keyVersion}:${sealed.encryptedSecret}`;
  }
}
