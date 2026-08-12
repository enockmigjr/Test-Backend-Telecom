import { BadRequestException, Injectable } from '@nestjs/common';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { PublicSupportConfigService } from '../../../config/public-support.config';
import { DrizzleProvider } from '../../../database/drizzle.provider';
import { trustedDevices } from '../../../database/schemas';
import { policyNumber } from '../../../common/utils/helpers';

export interface DevicePolicyImpact {
  readonly revokedDevices: number;
  readonly shortenedDevices: number;
}

@Injectable()
export class IntegrationTrustPolicyService {
  constructor(
    private readonly drizzle: DrizzleProvider,
    private readonly config: PublicSupportConfigService,
  ) {}

  assertProgression(previous: Record<string, unknown>, next: Record<string, unknown> | undefined): void {
    if (!next) return;
    if (policyNumber(next, 'policyVersion', 1) < policyNumber(previous, 'policyVersion', 1)) {
      throw new BadRequestException('La version de politique de confiance ne peut pas diminuer.');
    }
  }

  async reconcile(
    integrationId: string,
    previous: Record<string, unknown>,
    next: Record<string, unknown>,
  ): Promise<DevicePolicyImpact> {
    const oldVersion = policyNumber(previous, 'policyVersion', this.config.trustedDevicePolicyVersion);
    const newVersion = policyNumber(next, 'policyVersion', this.config.trustedDevicePolicyVersion);
    if (newVersion > oldVersion) {
      const revoked = await this.drizzle.db
        .update(trustedDevices)
        .set({ revokedAt: new Date() })
        .where(and(eq(trustedDevices.supportIntegrationId, integrationId), isNull(trustedDevices.revokedAt)))
        .returning({ id: trustedDevices.id });
      return { revokedDevices: revoked.length, shortenedDevices: 0 };
    }
    const oldDays = policyNumber(previous, 'trustedDeviceDays', this.config.trustedDeviceDays);
    const newDays = policyNumber(next, 'trustedDeviceDays', this.config.trustedDeviceDays);
    if (newDays >= oldDays) return { revokedDevices: 0, shortenedDevices: 0 };
    const shortened = await this.drizzle.db
      .update(trustedDevices)
      .set({
        expiresAt: sql`LEAST(${trustedDevices.expiresAt}, ${trustedDevices.createdAt} + ${newDays} * INTERVAL '1 day')`,
      })
      .where(and(eq(trustedDevices.supportIntegrationId, integrationId), isNull(trustedDevices.revokedAt)))
      .returning({ id: trustedDevices.id });
    return { revokedDevices: 0, shortenedDevices: shortened.length };
  }
}
