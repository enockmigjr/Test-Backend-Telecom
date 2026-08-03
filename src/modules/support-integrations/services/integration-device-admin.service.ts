import { Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { PaginationHelper } from '../../../common/helpers/pagination.helper';
import { normalizePagination } from '../../../common/helpers/normalized-pagination.helper';
import { DrizzleProvider } from '../../../database/drizzle.provider';
import { trustedDevices } from '../../../database/schemas';
import { AuditLogsService } from '../../audit-logs/audit-logs.service';
import { SupportIntegrationsService } from './support-integrations.service';

@Injectable()
export class IntegrationDeviceAdminService {
  constructor(
    private readonly drizzle: DrizzleProvider,
    private readonly integrations: SupportIntegrationsService,
    private readonly audit: AuditLogsService,
  ) {}

  async list(integrationId: string, pageInput?: number, limitInput?: number) {
    await this.integrations.requireIntegration(integrationId);
    const { page, limit } = normalizePagination(pageInput, limitInput ?? 25);
    const offset = PaginationHelper.getOffset(page, limit);
    const [total] = await this.drizzle.db
      .select({ count: sql<number>`count(*)` })
      .from(trustedDevices)
      .where(eq(trustedDevices.supportIntegrationId, integrationId));
    const devices = await this.drizzle.db
      .select({
        id: trustedDevices.id,
        externalRequesterId: trustedDevices.externalRequesterId,
        policyVersion: trustedDevices.policyVersion,
        expiresAt: trustedDevices.expiresAt,
        lastUsedAt: trustedDevices.lastUsedAt,
        revokedAt: trustedDevices.revokedAt,
        createdAt: trustedDevices.createdAt,
      })
      .from(trustedDevices)
      .where(eq(trustedDevices.supportIntegrationId, integrationId))
      .orderBy(desc(trustedDevices.createdAt))
      .limit(limit)
      .offset(offset);
    return PaginationHelper.paginate(devices, Number(total?.count ?? 0), page, limit);
  }

  async revoke(integrationId: string, deviceId: string, userId: string): Promise<void> {
    const [device] = await this.drizzle.db
      .update(trustedDevices)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(trustedDevices.id, deviceId),
          eq(trustedDevices.supportIntegrationId, integrationId),
          isNull(trustedDevices.revokedAt),
        ),
      )
      .returning({ id: trustedDevices.id, externalRequesterId: trustedDevices.externalRequesterId });
    if (!device) throw new NotFoundException('Appareil de confiance introuvable.');
    await this.audit.create(userId, 'TRUSTED_DEVICE_REVOKED', 'trusted_device', deviceId, undefined, {
      supportIntegrationId: integrationId,
      externalRequesterId: device.externalRequesterId,
    });
  }
}
