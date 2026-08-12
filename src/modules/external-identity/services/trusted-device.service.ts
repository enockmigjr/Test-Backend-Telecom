import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { and, desc, eq, gt, isNull } from 'drizzle-orm';
import { generateUuid } from '../../../common/helpers/uuidv7.helper';
import { PublicSupportConfigService } from '../../../config/public-support.config';
import { DrizzleProvider } from '../../../database/drizzle.provider';
import { supportIntegrations, trustedDevices } from '../../../database/schemas';
import { PublicIdentityCryptoService } from './public-identity-crypto.service';
import { trustedDevicePolicy } from './trusted-device-policy';
import { policyNumber } from '../../../common/utils/helpers';

export interface IssuedTrustedDevice {
  readonly deviceId: string;
  readonly token: string;
  readonly expiresAt: Date;
}

@Injectable()
export class TrustedDeviceService {
  constructor(
    private readonly drizzle: DrizzleProvider,
    private readonly crypto: PublicIdentityCryptoService,
    private readonly config: PublicSupportConfigService,
  ) {}

  async issue(externalRequesterId: string, supportIntegrationId: string): Promise<IssuedTrustedDevice> {
    const policy = await this.activePolicy(supportIntegrationId);
    const expiresAt = new Date(Date.now() + policy.days * 86_400_000);
    return this.insert(externalRequesterId, supportIntegrationId, policy.version, expiresAt);
  }

  async authenticate(integrationKey: string, token: string) {
    const [device] = await this.drizzle.db
      .select({
        id: trustedDevices.id,
        externalRequesterId: trustedDevices.externalRequesterId,
        supportIntegrationId: trustedDevices.supportIntegrationId,
        policyVersion: trustedDevices.policyVersion,
        expiresAt: trustedDevices.expiresAt,
        trustPolicy: supportIntegrations.trustPolicy,
      })
      .from(trustedDevices)
      .innerJoin(
        supportIntegrations,
        and(
          eq(supportIntegrations.id, trustedDevices.supportIntegrationId),
          eq(supportIntegrations.publicKey, integrationKey),
          eq(supportIntegrations.status, 'ACTIVE'),
        ),
      )
      .where(
        and(
          eq(trustedDevices.tokenHash, this.crypto.tokenHash(token)),
          isNull(trustedDevices.revokedAt),
          gt(trustedDevices.expiresAt, new Date()),
        ),
      )
      .limit(1);
    const currentVersion =
      device && policyNumber(device.trustPolicy, 'policyVersion', this.config.trustedDevicePolicyVersion);
    if (!device || device.policyVersion !== currentVersion) throw new UnauthorizedException('Appareil non reconnu.');
    await this.drizzle.db
      .update(trustedDevices)
      .set({ lastUsedAt: new Date() })
      .where(eq(trustedDevices.id, device.id));
    return device;
  }

  async rotate(deviceId: string, externalRequesterId: string, supportIntegrationId: string) {
    return this.drizzle.runInTransaction(async () => {
      const [device] = await this.drizzle.db
        .select({
          id: trustedDevices.id,
          expiresAt: trustedDevices.expiresAt,
          policyVersion: trustedDevices.policyVersion,
          trustPolicy: supportIntegrations.trustPolicy,
        })
        .from(trustedDevices)
        .innerJoin(
          supportIntegrations,
          and(
            eq(supportIntegrations.id, trustedDevices.supportIntegrationId),
            eq(supportIntegrations.status, 'ACTIVE'),
          ),
        )
        .where(
          and(
            eq(trustedDevices.id, deviceId),
            eq(trustedDevices.externalRequesterId, externalRequesterId),
            eq(trustedDevices.supportIntegrationId, supportIntegrationId),
            isNull(trustedDevices.revokedAt),
            gt(trustedDevices.expiresAt, new Date()),
          ),
        )
        .limit(1);
      if (!device) throw new UnauthorizedException('Appareil non reconnu.');
      const policy = trustedDevicePolicy(device.trustPolicy, this.config);
      if (device.policyVersion !== policy.version) throw new UnauthorizedException('Appareil non reconnu.');
      const now = new Date();
      const renewalThreshold = now.getTime() + policy.renewalWindowDays * 86_400_000;
      const expiresAt =
        device.expiresAt.getTime() <= renewalThreshold
          ? new Date(now.getTime() + policy.days * 86_400_000)
          : device.expiresAt;
      const [revoked] = await this.drizzle.db
        .update(trustedDevices)
        .set({ revokedAt: now })
        .where(and(eq(trustedDevices.id, device.id), isNull(trustedDevices.revokedAt)))
        .returning({ id: trustedDevices.id });
      if (!revoked) throw new UnauthorizedException('Appareil non reconnu.');
      return this.insert(externalRequesterId, supportIntegrationId, policy.version, expiresAt);
    });
  }

  async revoke(deviceId: string, externalRequesterId: string): Promise<void> {
    await this.drizzle.db
      .update(trustedDevices)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(trustedDevices.id, deviceId),
          eq(trustedDevices.externalRequesterId, externalRequesterId),
          isNull(trustedDevices.revokedAt),
        ),
      );
  }

  async list(externalRequesterId: string, supportIntegrationId: string, currentDeviceId?: string) {
    const columns = {
      id: trustedDevices.id,
      createdAt: trustedDevices.createdAt,
      lastUsedAt: trustedDevices.lastUsedAt,
      expiresAt: trustedDevices.expiresAt,
      revokedAt: trustedDevices.revokedAt,
    };
    const scope = and(
      eq(trustedDevices.externalRequesterId, externalRequesterId),
      eq(trustedDevices.supportIntegrationId, supportIntegrationId),
    );
    const [active, history] = await Promise.all([
      this.drizzle.db
        .select(columns)
        .from(trustedDevices)
        .where(and(scope, isNull(trustedDevices.revokedAt)))
        .orderBy(desc(trustedDevices.createdAt)),
      this.drizzle.db
        .select(columns)
        .from(trustedDevices)
        .where(and(scope, gt(trustedDevices.revokedAt, new Date(0))))
        .orderBy(desc(trustedDevices.createdAt))
        .limit(20),
    ]);
    const rows = [...active, ...history];
    return { data: rows.map((device) => ({ ...device, current: device.id === currentDeviceId })) };
  }

  async revokeScoped(deviceId: string, externalRequesterId: string, supportIntegrationId: string): Promise<void> {
    const [revoked] = await this.drizzle.db
      .update(trustedDevices)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(trustedDevices.id, deviceId),
          eq(trustedDevices.externalRequesterId, externalRequesterId),
          eq(trustedDevices.supportIntegrationId, supportIntegrationId),
          isNull(trustedDevices.revokedAt),
        ),
      )
      .returning({ id: trustedDevices.id });
    if (!revoked) throw new NotFoundException('Appareil introuvable.');
  }

  private async activePolicy(supportIntegrationId: string) {
    const [integration] = await this.drizzle.db
      .select({ trustPolicy: supportIntegrations.trustPolicy })
      .from(supportIntegrations)
      .where(and(eq(supportIntegrations.id, supportIntegrationId), eq(supportIntegrations.status, 'ACTIVE')))
      .limit(1);
    if (!integration) throw new UnauthorizedException('Intégration inactive.');
    return trustedDevicePolicy(integration.trustPolicy, this.config);
  }

  private async insert(
    externalRequesterId: string,
    supportIntegrationId: string,
    policyVersion: number,
    expiresAt: Date,
  ): Promise<IssuedTrustedDevice> {
    const token = this.crypto.randomOpaqueToken();
    const deviceId = generateUuid();
    await this.drizzle.db.insert(trustedDevices).values({
      id: deviceId,
      supportIntegrationId,
      externalRequesterId,
      tokenHash: this.crypto.tokenHash(token),
      policyVersion,
      expiresAt,
    });
    return { deviceId, token, expiresAt };
  }
}
