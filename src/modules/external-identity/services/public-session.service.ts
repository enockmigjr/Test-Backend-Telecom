import { Injectable, UnauthorizedException } from '@nestjs/common';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { JwtPayload as JsonWebTokenPayload, sign, verify } from 'jsonwebtoken';
import { generateUuid } from '../../../common/helpers/uuidv7.helper';
import { PublicSupportConfigService } from '../../../config/public-support.config';
import { DrizzleProvider } from '../../../database/drizzle.provider';
import { externalRequesters, supportIntegrations, trustedDevices } from '../../../database/schemas';
import { PublicPrincipal } from '../interfaces/public-principal.interface';

interface PublicSessionPayload extends JsonWebTokenPayload {
  readonly kind: 'PUBLIC';
  readonly sub: string;
  readonly integrationId: string;
  readonly deviceId: string;
  readonly jti: string;
}

@Injectable()
export class PublicSessionService {
  constructor(
    private readonly config: PublicSupportConfigService,
    private readonly drizzle: DrizzleProvider,
  ) {}

  get expiresInSeconds(): number {
    return this.config.publicSessionTtlSeconds;
  }

  issue(externalRequesterId: string, supportIntegrationId: string, deviceId: string): string {
    return sign(
      { kind: 'PUBLIC', integrationId: supportIntegrationId, deviceId, jti: generateUuid() },
      this.config.publicSessionSecret,
      {
        subject: externalRequesterId,
        issuer: this.config.publicSessionIssuer,
        audience: this.config.publicSessionAudience,
        expiresIn: this.config.publicSessionTtlSeconds,
        algorithm: 'HS256',
      },
    );
  }

  async validate(token: string): Promise<PublicPrincipal> {
    const decoded = this.verifyToken(token);
    const [requester] = await this.drizzle.db
      .select({ requesterId: externalRequesters.id })
      .from(externalRequesters)
      .innerJoin(
        supportIntegrations,
        and(
          eq(supportIntegrations.id, externalRequesters.supportIntegrationId),
          eq(supportIntegrations.status, 'ACTIVE'),
        ),
      )
      .where(
        and(
          eq(externalRequesters.id, decoded.sub),
          eq(externalRequesters.supportIntegrationId, decoded.integrationId),
          isNull(externalRequesters.anonymizedAt),
        ),
      )
      .limit(1);
    if (!requester) throw new UnauthorizedException('Session publique révoquée.');
    await this.requireActiveDevice(decoded);
    return {
      kind: 'PUBLIC',
      sub: decoded.sub,
      externalRequesterId: decoded.sub,
      supportIntegrationId: decoded.integrationId,
      deviceId: decoded.deviceId,
      jti: decoded.jti,
    };
  }

  private verifyToken(token: string): PublicSessionPayload {
    let decoded: string | JsonWebTokenPayload;
    try {
      decoded = verify(token, this.config.publicSessionSecret, {
        issuer: this.config.publicSessionIssuer,
        audience: this.config.publicSessionAudience,
        algorithms: ['HS256'],
      });
    } catch {
      throw new UnauthorizedException('Session publique invalide ou expirée.');
    }
    if (!isPublicSessionPayload(decoded)) throw new UnauthorizedException('Session publique invalide.');
    return decoded;
  }

  private async requireActiveDevice(payload: PublicSessionPayload): Promise<void> {
    const [device] = await this.drizzle.db
      .select({ policyVersion: trustedDevices.policyVersion, trustPolicy: supportIntegrations.trustPolicy })
      .from(trustedDevices)
      .innerJoin(
        supportIntegrations,
        and(eq(supportIntegrations.id, trustedDevices.supportIntegrationId), eq(supportIntegrations.status, 'ACTIVE')),
      )
      .where(
        and(
          eq(trustedDevices.id, payload.deviceId),
          eq(trustedDevices.externalRequesterId, payload.sub),
          eq(trustedDevices.supportIntegrationId, payload.integrationId),
          isNull(trustedDevices.revokedAt),
          gt(trustedDevices.expiresAt, new Date()),
        ),
      )
      .limit(1);
    if (!device || device.policyVersion !== policyVersion(device.trustPolicy, this.config.trustedDevicePolicyVersion)) {
      throw new UnauthorizedException('Appareil public révoqué ou expiré.');
    }
  }
}

function isPublicSessionPayload(value: string | JsonWebTokenPayload): value is PublicSessionPayload {
  return (
    typeof value !== 'string' &&
    value.kind === 'PUBLIC' &&
    typeof value.sub === 'string' &&
    typeof value.integrationId === 'string' &&
    typeof value.deviceId === 'string' &&
    typeof value.jti === 'string'
  );
}

function policyVersion(policy: Record<string, unknown>, fallback: number): number {
  const value = policy['policyVersion'];
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : fallback;
}
