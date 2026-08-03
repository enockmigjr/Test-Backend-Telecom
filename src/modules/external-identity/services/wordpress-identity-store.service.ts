import { Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { generateUuid } from '../../../common/helpers/uuidv7.helper';
import { DrizzleProvider } from '../../../database/drizzle.provider';
import { externalIdentities, externalRequesters } from '../../../database/schemas';
import { IntegrationSecretCipherService } from '../../support-integrations/services/integration-secret-cipher.service';
import { PublicIdentityCryptoService } from './public-identity-crypto.service';

interface WordPressIdentityInput {
  readonly supportIntegrationId: string;
  readonly subject: string;
  readonly email: string;
  readonly displayName?: string;
}

@Injectable()
export class WordPressIdentityStoreService {
  constructor(
    private readonly drizzle: DrizzleProvider,
    private readonly cipher: IntegrationSecretCipherService,
    private readonly crypto: PublicIdentityCryptoService,
  ) {}

  async upsert(input: WordPressIdentityInput): Promise<string> {
    const normalizedHash = this.crypto.contactHash(input.supportIntegrationId, 'WORDPRESS', input.subject);
    return this.drizzle.runInTransaction(async () => {
      const [existing] = await this.drizzle.db
        .select()
        .from(externalIdentities)
        .where(
          and(
            eq(externalIdentities.supportIntegrationId, input.supportIntegrationId),
            eq(externalIdentities.identityType, 'WORDPRESS'),
            eq(externalIdentities.normalizedValueHash, normalizedHash),
          ),
        )
        .limit(1);
      if (existing) {
        await this.drizzle.db
          .update(externalIdentities)
          .set({
            encryptedValue: this.seal(existing.id, input.email),
            providerSubject: input.subject,
            verifiedAt: new Date(),
            revokedAt: null,
          })
          .where(eq(externalIdentities.id, existing.id));
        await this.touchRequester(existing.externalRequesterId, input.displayName);
        return existing.externalRequesterId;
      }
      return this.create(input, normalizedHash);
    });
  }

  private async create(input: WordPressIdentityInput, normalizedHash: string): Promise<string> {
    const requesterId = generateUuid();
    const identityId = generateUuid();
    await this.drizzle.db.insert(externalRequesters).values({
      id: requesterId,
      supportIntegrationId: input.supportIntegrationId,
      displayName: input.displayName,
      lastSeenAt: new Date(),
    });
    await this.drizzle.db.insert(externalIdentities).values({
      id: identityId,
      supportIntegrationId: input.supportIntegrationId,
      externalRequesterId: requesterId,
      identityType: 'WORDPRESS',
      normalizedValueHash: normalizedHash,
      encryptedValue: this.seal(identityId, input.email),
      providerSubject: input.subject,
      verifiedAt: new Date(),
    });
    return requesterId;
  }

  private seal(identityId: string, value: string): string {
    const sealed = this.cipher.seal(value, `identity:${identityId}`);
    return `${sealed.keyVersion}:${sealed.encryptedSecret}`;
  }

  private async touchRequester(requesterId: string, displayName?: string): Promise<void> {
    await this.drizzle.db
      .update(externalRequesters)
      .set({ lastSeenAt: new Date(), ...(displayName === undefined ? {} : { displayName }) })
      .where(eq(externalRequesters.id, requesterId));
  }
}
