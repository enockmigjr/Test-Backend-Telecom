import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq, gt, isNull, lte, or } from 'drizzle-orm';
import { randomBytes } from 'crypto';
import { generateUuid } from '../../../common/helpers/uuidv7.helper';
import { PublicSupportConfigService } from '../../../config/public-support.config';
import { DrizzleProvider } from '../../../database/drizzle.provider';
import { integrationCredentials, supportIntegrations } from '../../../database/schemas';
import { AuditLogsService } from '../../audit-logs/audit-logs.service';
import { CreateSupportIntegrationDto, UpdateSupportIntegrationDto } from '../dto/support-integration.dto';
import { normalizeExactOrigins } from './integration-origin-policy';
import { DevicePolicyImpact, IntegrationTrustPolicyService } from './integration-trust-policy.service';

@Injectable()
export class SupportIntegrationsService {
  constructor(
    private readonly drizzle: DrizzleProvider,
    private readonly audit: AuditLogsService,
    private readonly config: PublicSupportConfigService,
    private readonly trustPolicies: IntegrationTrustPolicyService,
  ) {}

  async create(dto: CreateSupportIntegrationDto, userId: string) {
    const id = generateUuid();
    const values = this.valuesFrom(dto);
    return this.drizzle.runInTransaction(async () => {
      const [created] = await this.drizzle.db
        .insert(supportIntegrations)
        .values({
          id,
          publicKey: randomBytes(24).toString('base64url'),
          status: 'DRAFT',
          name: dto.name.trim(),
          allowedOrigins: normalizeExactOrigins(dto.allowedOrigins),
          ...values,
        })
        .returning();
      await this.audit.create(userId, 'SUPPORT_INTEGRATION_CREATED', 'support_integration', id, undefined, {
        name: created?.name,
        allowedOrigins: created?.allowedOrigins,
      });
      return { data: created };
    });
  }

  async list() {
    return { data: await this.drizzle.db.select().from(supportIntegrations).orderBy(supportIntegrations.createdAt) };
  }

  async findOne(id: string) {
    const integration = await this.requireIntegration(id);
    return { data: integration };
  }

  async update(id: string, dto: UpdateSupportIntegrationDto, userId: string) {
    const existing = await this.requireIntegration(id);
    if (dto.status === 'ACTIVE') await this.assertActiveCredential(id);
    const changes = this.valuesFrom(dto, existing);
    this.trustPolicies.assertProgression(existing.trustPolicy, changes.trustPolicy);
    return this.drizzle.runInTransaction(async () => {
      const [updated] = await this.drizzle.db
        .update(supportIntegrations)
        .set({ ...changes, status: dto.status ?? existing.status, updatedAt: new Date() })
        .where(eq(supportIntegrations.id, id))
        .returning();
      const policyImpact = changes.trustPolicy
        ? await this.trustPolicies.reconcile(id, existing.trustPolicy, changes.trustPolicy)
        : undefined;
      await this.audit.create(
        userId,
        'SUPPORT_INTEGRATION_UPDATED',
        'support_integration',
        id,
        summarize(existing),
        summarize(updated, policyImpact),
      );
      return { data: updated };
    });
  }

  async requireIntegration(id: string) {
    const [integration] = await this.drizzle.db
      .select()
      .from(supportIntegrations)
      .where(eq(supportIntegrations.id, id))
      .limit(1);
    if (!integration) throw new NotFoundException('Intégration de support introuvable.');
    return integration;
  }

  private valuesFrom(dto: Partial<CreateSupportIntegrationDto>, existing?: typeof supportIntegrations.$inferSelect) {
    if (dto.features && Object.values(dto.features).some((value) => typeof value !== 'boolean')) {
      throw new BadRequestException('Chaque feature doit être booléenne.');
    }
    const trustPolicy = dto.trustPolicy
      ? {
          trustedDeviceDays:
            dto.trustPolicy.trustedDeviceDays ??
            policyNumber(existing?.trustPolicy, 'trustedDeviceDays', this.config.trustedDeviceDays),
          policyVersion:
            dto.trustPolicy.policyVersion ??
            policyNumber(existing?.trustPolicy, 'policyVersion', this.config.trustedDevicePolicyVersion),
          renewalWindowDays:
            dto.trustPolicy.renewalWindowDays ?? policyNumber(existing?.trustPolicy, 'renewalWindowDays', 7),
        }
      : undefined;
    const quotaPolicy = dto.quotaPolicy
      ? {
          attachmentUploadsPerHour:
            dto.quotaPolicy.attachmentUploadsPerHour ??
            policyNumber(existing?.quotaPolicy, 'attachmentUploadsPerHour', 20),
          attachmentUploadsPerIpHour:
            dto.quotaPolicy.attachmentUploadsPerIpHour ??
            policyNumber(existing?.quotaPolicy, 'attachmentUploadsPerIpHour', 50),
          attachmentUploadsPerIntegrationHour:
            dto.quotaPolicy.attachmentUploadsPerIntegrationHour ??
            policyNumber(existing?.quotaPolicy, 'attachmentUploadsPerIntegrationHour', 1000),
          attachmentMaxBytes:
            dto.quotaPolicy.attachmentMaxBytes ??
            policyNumber(existing?.quotaPolicy, 'attachmentMaxBytes', 10 * 1024 * 1024),
          verificationRequestsPerHour:
            dto.quotaPolicy.verificationRequestsPerHour ??
            policyNumber(existing?.quotaPolicy, 'verificationRequestsPerHour', 5),
          verificationAttemptsPerHour:
            dto.quotaPolicy.verificationAttemptsPerHour ??
            policyNumber(existing?.quotaPolicy, 'verificationAttemptsPerHour', 10),
          verificationRequestsPerIpHour:
            dto.quotaPolicy.verificationRequestsPerIpHour ??
            policyNumber(existing?.quotaPolicy, 'verificationRequestsPerIpHour', 20),
          verificationRequestsPerIntegrationHour:
            dto.quotaPolicy.verificationRequestsPerIntegrationHour ??
            policyNumber(existing?.quotaPolicy, 'verificationRequestsPerIntegrationHour', 500),
          verificationAttemptsPerIpHour:
            dto.quotaPolicy.verificationAttemptsPerIpHour ??
            policyNumber(existing?.quotaPolicy, 'verificationAttemptsPerIpHour', 50),
          verificationAttemptsPerIntegrationHour:
            dto.quotaPolicy.verificationAttemptsPerIntegrationHour ??
            policyNumber(existing?.quotaPolicy, 'verificationAttemptsPerIntegrationHour', 2000),
        }
      : undefined;
    return {
      ...(dto.name === undefined ? {} : { name: dto.name.trim() }),
      ...(dto.allowedOrigins === undefined ? {} : { allowedOrigins: normalizeExactOrigins(dto.allowedOrigins) }),
      ...(dto.appearance === undefined ? {} : { appearance: dto.appearance }),
      ...(dto.routingPolicy === undefined ? {} : { routingPolicy: dto.routingPolicy }),
      ...(quotaPolicy === undefined ? {} : { quotaPolicy }),
      ...(trustPolicy === undefined ? {} : { trustPolicy }),
      ...(dto.features === undefined ? {} : { features: dto.features }),
    };
  }

  private async assertActiveCredential(integrationId: string): Promise<void> {
    const now = new Date();
    const [credential] = await this.drizzle.db
      .select({ id: integrationCredentials.id })
      .from(integrationCredentials)
      .where(
        and(
          eq(integrationCredentials.supportIntegrationId, integrationId),
          lte(integrationCredentials.activeFrom, now),
          or(isNull(integrationCredentials.revokedAt), gt(integrationCredentials.revokedAt, now)),
        ),
      )
      .limit(1);
    if (!credential) throw new BadRequestException('Un secret actif est requis avant activation.');
  }
}

function summarize(
  value: typeof supportIntegrations.$inferSelect | undefined,
  devicePolicyImpact?: DevicePolicyImpact,
) {
  if (!value) return null;
  return {
    name: value.name,
    status: value.status,
    allowedOrigins: value.allowedOrigins,
    routingPolicy: value.routingPolicy,
    quotaPolicy: value.quotaPolicy,
    trustPolicy: value.trustPolicy,
    features: value.features,
    ...(devicePolicyImpact === undefined ? {} : { devicePolicyImpact }),
  };
}

function policyNumber(policy: Record<string, unknown> | undefined, key: string, fallback: number): number {
  const value = policy?.[key];
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : fallback;
}
