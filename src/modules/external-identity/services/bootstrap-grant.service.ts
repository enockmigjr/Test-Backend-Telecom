import { Injectable, UnauthorizedException } from '@nestjs/common';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { generateUuid } from '../../../common/helpers/uuidv7.helper';
import { PublicSupportConfigService } from '../../../config/public-support.config';
import { DrizzleProvider } from '../../../database/drizzle.provider';
import { publicBootstrapGrants } from '../../../database/schemas';
import { PublicIdentityCryptoService } from './public-identity-crypto.service';

@Injectable()
export class BootstrapGrantService {
  constructor(
    private readonly drizzle: DrizzleProvider,
    private readonly config: PublicSupportConfigService,
    private readonly crypto: PublicIdentityCryptoService,
  ) {}

  async issue(externalRequesterId: string, supportIntegrationId: string, trustedDeviceId: string) {
    const code = this.crypto.randomOpaqueToken();
    const expiresAt = new Date(Date.now() + this.config.bootstrapTtlSeconds * 1000);
    await this.drizzle.db.insert(publicBootstrapGrants).values({
      id: generateUuid(),
      supportIntegrationId,
      externalRequesterId,
      trustedDeviceId,
      codeHash: this.crypto.opaqueHash('bootstrap', code),
      audience: this.config.publicSessionAudience,
      expiresAt,
    });
    return { code, expiresAt };
  }

  async consume(code: string) {
    const [grant] = await this.drizzle.db
      .update(publicBootstrapGrants)
      .set({ consumedAt: new Date() })
      .where(
        and(
          eq(publicBootstrapGrants.codeHash, this.crypto.opaqueHash('bootstrap', code)),
          eq(publicBootstrapGrants.audience, this.config.publicSessionAudience),
          isNull(publicBootstrapGrants.consumedAt),
          gt(publicBootstrapGrants.expiresAt, new Date()),
        ),
      )
      .returning({
        externalRequesterId: publicBootstrapGrants.externalRequesterId,
        supportIntegrationId: publicBootstrapGrants.supportIntegrationId,
        trustedDeviceId: publicBootstrapGrants.trustedDeviceId,
      });
    if (!grant) throw new UnauthorizedException('Code de transfert invalide ou expiré.');
    return grant;
  }
}
