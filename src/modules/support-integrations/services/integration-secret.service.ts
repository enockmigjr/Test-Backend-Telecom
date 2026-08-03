import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, gt, isNull, lte, or, sql } from 'drizzle-orm';
import { generateUuid } from '../../../common/helpers/uuidv7.helper';
import { PublicSupportConfigService } from '../../../config/public-support.config';
import { DrizzleProvider } from '../../../database/drizzle.provider';
import { integrationCredentials } from '../../../database/schemas';
import { AuditLogsService } from '../../audit-logs/audit-logs.service';
import { IntegrationSecretCipherService } from './integration-secret-cipher.service';
import { SupportIntegrationsService } from './support-integrations.service';

export interface ActiveIntegrationSecret {
  readonly credentialId: string;
  readonly version: number;
  readonly secret: string;
}

@Injectable()
export class IntegrationSecretService {
  constructor(
    private readonly drizzle: DrizzleProvider,
    private readonly integrations: SupportIntegrationsService,
    private readonly cipher: IntegrationSecretCipherService,
    private readonly config: PublicSupportConfigService,
    private readonly audit: AuditLogsService,
  ) {}

  async rotate(integrationId: string, secret: string, userId: string) {
    assertStrongSecret(secret);
    await this.integrations.requireIntegration(integrationId);
    const now = new Date();
    const graceUntil = new Date(now.getTime() + this.config.secretRotationGraceMinutes * 60_000);
    return this.drizzle.runInTransaction(async () => {
      await this.drizzle.db.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${integrationId}, 0))`);
      const [latest] = await this.drizzle.db
        .select({ version: integrationCredentials.version })
        .from(integrationCredentials)
        .where(eq(integrationCredentials.supportIntegrationId, integrationId))
        .orderBy(desc(integrationCredentials.version))
        .limit(1);
      const version = (latest?.version ?? 0) + 1;
      const sealed = this.cipher.seal(secret, context(integrationId, version));
      await this.drizzle.db
        .update(integrationCredentials)
        .set({ revokedAt: graceUntil })
        .where(
          and(
            eq(integrationCredentials.supportIntegrationId, integrationId),
            or(isNull(integrationCredentials.revokedAt), gt(integrationCredentials.revokedAt, graceUntil)),
          ),
        );
      const [credential] = await this.drizzle.db
        .insert(integrationCredentials)
        .values({
          id: generateUuid(),
          supportIntegrationId: integrationId,
          version,
          encryptedSecret: sealed.encryptedSecret,
          encryptionKeyVersion: sealed.keyVersion,
          activeFrom: now,
        })
        .returning({ id: integrationCredentials.id, version: integrationCredentials.version });
      await this.audit.create(userId, 'INTEGRATION_SECRET_ROTATED', 'support_integration', integrationId, undefined, {
        credentialId: credential?.id,
        version,
        previousValidUntil: graceUntil.toISOString(),
      });
      return { data: { credentialId: credential?.id, version, previousValidUntil: graceUntil } };
    });
  }

  async activeSecrets(integrationId: string): Promise<ActiveIntegrationSecret[]> {
    const now = new Date();
    const credentials = await this.drizzle.db
      .select()
      .from(integrationCredentials)
      .where(
        and(
          eq(integrationCredentials.supportIntegrationId, integrationId),
          lte(integrationCredentials.activeFrom, now),
          or(isNull(integrationCredentials.revokedAt), gt(integrationCredentials.revokedAt, now)),
        ),
      )
      .orderBy(desc(integrationCredentials.version));
    return credentials.map((credential) => ({
      credentialId: credential.id,
      version: credential.version,
      secret: this.cipher.open(
        credential.encryptedSecret,
        credential.encryptionKeyVersion,
        context(integrationId, credential.version),
      ),
    }));
  }

  async listMetadata(integrationId: string) {
    await this.integrations.requireIntegration(integrationId);
    const credentials = await this.drizzle.db
      .select({
        id: integrationCredentials.id,
        version: integrationCredentials.version,
        activeFrom: integrationCredentials.activeFrom,
        revokedAt: integrationCredentials.revokedAt,
        createdAt: integrationCredentials.createdAt,
      })
      .from(integrationCredentials)
      .where(eq(integrationCredentials.supportIntegrationId, integrationId))
      .orderBy(desc(integrationCredentials.version));
    return { data: credentials };
  }

  async revoke(integrationId: string, credentialId: string, userId: string) {
    const [credential] = await this.drizzle.db
      .update(integrationCredentials)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(integrationCredentials.id, credentialId),
          eq(integrationCredentials.supportIntegrationId, integrationId),
        ),
      )
      .returning({ id: integrationCredentials.id, version: integrationCredentials.version });
    if (!credential) throw new NotFoundException("Secret d'intégration introuvable.");
    await this.audit.create(userId, 'INTEGRATION_SECRET_REVOKED', 'support_integration', integrationId, undefined, {
      credentialId,
      version: credential.version,
    });
  }
}

function context(integrationId: string, version: number): string {
  return `support-integration:${integrationId}:credential:${version}`;
}

function assertStrongSecret(secret: string): void {
  if (!/^[A-Za-z0-9_-]{43}$/.test(secret)) {
    throw new BadRequestException("Le secret d'intégration doit être une valeur base64url aléatoire de 32 octets.");
  }
  const decoded = Buffer.from(secret, 'base64url');
  if (decoded.length !== 32 || decoded.toString('base64url') !== secret) {
    throw new BadRequestException("Le secret d'intégration doit être une valeur base64url canonique de 32 octets.");
  }
}
