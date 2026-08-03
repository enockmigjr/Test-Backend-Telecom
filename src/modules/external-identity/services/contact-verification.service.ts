import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, gt, sql } from 'drizzle-orm';
import { randomInt } from 'crypto';
import { generateUuid } from '../../../common/helpers/uuidv7.helper';
import { PublicSupportConfigService } from '../../../config/public-support.config';
import { DrizzleProvider } from '../../../database/drizzle.provider';
import { externalVerificationChallenges, supportIntegrations } from '../../../database/schemas';
import { IntegrationSecretCipherService } from '../../support-integrations/services/integration-secret-cipher.service';
import {
  CONTACT_VERIFICATION_PROVIDER,
  ContactVerificationProvider,
} from '../providers/contact-verification-provider.interface';
import { ExternalIdentityStoreService } from './external-identity-store.service';
import { PublicIdentityCryptoService } from './public-identity-crypto.service';
import { PublicRateLimitService } from './public-rate-limit.service';
import { VerificationOutcome } from './verification-outcome';

@Injectable()
export class ContactVerificationService {
  constructor(
    private readonly drizzle: DrizzleProvider,
    private readonly config: PublicSupportConfigService,
    private readonly crypto: PublicIdentityCryptoService,
    private readonly cipher: IntegrationSecretCipherService,
    private readonly quotas: PublicRateLimitService,
    private readonly identityStore: ExternalIdentityStoreService,
    @Inject(CONTACT_VERIFICATION_PROVIDER) private readonly provider: ContactVerificationProvider,
  ) {}

  async requestEmail(integrationKey: string, emailInput: string, ipAddress: string) {
    const email = emailInput.trim().toLowerCase();
    const [integration] = await this.drizzle.db
      .select()
      .from(supportIntegrations)
      .where(and(eq(supportIntegrations.publicKey, integrationKey), eq(supportIntegrations.status, 'ACTIVE')))
      .limit(1);
    const integrationDimension = integration?.id ?? integrationKey;
    const contactHash = this.crypto.contactHash(integrationDimension, 'EMAIL', email);
    const requestContactLimit = policyNumber(integration?.quotaPolicy, 'verificationRequestsPerHour', 5);
    await this.quotas.consume(
      'verification-request',
      [
        {
          value: `ip:${ipAddress}`,
          limit: policyNumber(integration?.quotaPolicy, 'verificationRequestsPerIpHour', 20),
        },
        {
          value: `integration:${integrationDimension}`,
          limit: policyNumber(integration?.quotaPolicy, 'verificationRequestsPerIntegrationHour', 500),
        },
        { value: `contact:${contactHash}`, limit: requestContactLimit },
      ],
      3600,
    );
    if (!integration) return uniformRequest(generateUuid());

    const [recent] = await this.drizzle.db
      .select()
      .from(externalVerificationChallenges)
      .where(
        and(
          eq(externalVerificationChallenges.supportIntegrationId, integration.id),
          eq(externalVerificationChallenges.identityType, 'EMAIL'),
          eq(externalVerificationChallenges.contactHash, contactHash),
          eq(externalVerificationChallenges.status, 'PENDING'),
          gt(externalVerificationChallenges.expiresAt, new Date()),
        ),
      )
      .orderBy(desc(externalVerificationChallenges.createdAt))
      .limit(1);
    const resendAfter = new Date(Date.now() - this.config.otpResendSeconds * 1000);
    if (recent && recent.createdAt > resendAfter) return uniformRequest(recent.id);

    const challengeId = generateUuid();
    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    const expiresAt = new Date(Date.now() + this.config.otpTtlSeconds * 1000);
    const sealed = this.cipher.seal(email, `verification:${challengeId}`);
    await this.drizzle.runInTransaction(async () => {
      await this.drizzle.db.execute(
        sql`SELECT pg_advisory_xact_lock(hashtextextended(${`otp:${integration.id}:${contactHash}`}, 0))`,
      );
      await this.drizzle.db
        .update(externalVerificationChallenges)
        .set({ status: 'EXPIRED' })
        .where(
          and(
            eq(externalVerificationChallenges.supportIntegrationId, integration.id),
            eq(externalVerificationChallenges.identityType, 'EMAIL'),
            eq(externalVerificationChallenges.contactHash, contactHash),
            eq(externalVerificationChallenges.status, 'PENDING'),
          ),
        );
      await this.drizzle.db.insert(externalVerificationChallenges).values({
        id: challengeId,
        supportIntegrationId: integration.id,
        identityType: 'EMAIL',
        contactHash,
        encryptedDestination: `${sealed.keyVersion}:${sealed.encryptedSecret}`,
        codeHash: this.crypto.codeHash(challengeId, code),
        maxAttempts: this.config.otpMaxAttempts,
        expiresAt,
      });
      this.drizzle.afterCommit(() => this.provider.sendEmailCode(email, code, this.config.otpTtlSeconds));
    });
    return uniformRequest(challengeId);
  }

  async consumeEmail(challengeId: string, code: string, ipAddress: string): Promise<VerificationOutcome> {
    await this.quotas.consume(
      'verification-consume-preflight',
      [
        { value: `ip:${ipAddress}`, limit: 50 },
        { value: `challenge:${challengeId}`, limit: 10 },
      ],
      3600,
    );
    const challenge = await this.identityStore.findChallenge(challengeId);
    if (!challenge || challenge.status !== 'PENDING') return { verified: false };
    const attemptPolicy = await this.verificationAttemptPolicy(challenge.supportIntegrationId);
    await this.quotas.consume(
      'verification-attempt',
      [
        { value: `ip:${ipAddress}`, limit: attemptPolicy.ip },
        { value: `integration:${challenge.supportIntegrationId}`, limit: attemptPolicy.integration },
        { value: `contact:${challenge.contactHash}`, limit: attemptPolicy.contact },
      ],
      3600,
    );
    if (challenge.expiresAt <= new Date()) {
      await this.identityStore.expireChallenge(challengeId);
      return { verified: false };
    }
    const codeMatches = this.crypto.matches(challenge.codeHash, this.crypto.codeHash(challengeId, code));
    if (!codeMatches) {
      await this.identityStore.recordFailure(challengeId);
      return { verified: false };
    }
    return this.identityStore.consume(challenge);
  }

  private async verificationAttemptPolicy(integrationId: string) {
    const [integration] = await this.drizzle.db
      .select({ quotaPolicy: supportIntegrations.quotaPolicy })
      .from(supportIntegrations)
      .where(eq(supportIntegrations.id, integrationId))
      .limit(1);
    return {
      ip: policyNumber(integration?.quotaPolicy, 'verificationAttemptsPerIpHour', 50),
      integration: policyNumber(integration?.quotaPolicy, 'verificationAttemptsPerIntegrationHour', 2000),
      contact: policyNumber(integration?.quotaPolicy, 'verificationAttemptsPerHour', 10),
    };
  }
}

function uniformRequest(challengeId: string) {
  return { data: { challengeId }, message: 'Si la demande est valide, un code de vérification sera envoyé.' };
}

function policyNumber(policy: Record<string, unknown> | null, key: string, fallback: number): number {
  const value = policy?.[key];
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : fallback;
}
