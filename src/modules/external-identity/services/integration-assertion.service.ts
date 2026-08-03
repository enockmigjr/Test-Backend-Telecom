import { Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { decode, JwtPayload, verify } from 'jsonwebtoken';
import { isEmail } from 'class-validator';
import { RedisProvider } from '../../../common/providers/redis.provider';
import { PublicSupportConfigService } from '../../../config/public-support.config';
import { DrizzleProvider } from '../../../database/drizzle.provider';
import { supportIntegrations } from '../../../database/schemas';
import { IntegrationSecretService } from '../../support-integrations/services/integration-secret.service';
import { normalizeExactOrigins } from '../../support-integrations/services/integration-origin-policy';
import { PublicPrincipal } from '../interfaces/public-principal.interface';
import { WordPressIdentityStoreService } from './wordpress-identity-store.service';

interface IntegrationAssertionPayload extends JwtPayload {
  readonly iss: string;
  readonly aud: string | string[];
  readonly sub: string;
  readonly integration_id: string;
  readonly email: string;
  readonly origin: string;
  readonly jti: string;
  readonly iat: number;
  readonly exp: number;
  readonly display_name?: string;
}

@Injectable()
export class IntegrationAssertionService {
  constructor(
    private readonly drizzle: DrizzleProvider,
    private readonly secrets: IntegrationSecretService,
    private readonly identities: WordPressIdentityStoreService,
    private readonly redisProvider: RedisProvider,
    private readonly config: PublicSupportConfigService,
  ) {}

  async exchange(compactAssertion: string): Promise<PublicPrincipal> {
    const routingPayload = decode(compactAssertion);
    if (!isRoutingPayload(routingPayload)) throw new UnauthorizedException('Assertion invalide.');
    const [integration] = await this.drizzle.db
      .select()
      .from(supportIntegrations)
      .where(and(eq(supportIntegrations.publicKey, routingPayload.iss), eq(supportIntegrations.status, 'ACTIVE')))
      .limit(1);
    if (!integration || routingPayload.integration_id !== integration.id) {
      throw new UnauthorizedException('Assertion invalide.');
    }
    const payload = await this.verifyWithActiveSecret(compactAssertion, integration.id, integration.publicKey);
    let normalizedOrigin: string | undefined;
    try {
      normalizedOrigin = normalizeExactOrigins([payload.origin])[0];
    } catch {
      throw new UnauthorizedException('Origine non autorisée.');
    }
    if (!normalizedOrigin || !integration.allowedOrigins.includes(normalizedOrigin)) {
      throw new UnauthorizedException('Origine non autorisée.');
    }
    await this.consumeNonce(integration.id, payload.jti, payload.exp);
    const requesterId = await this.identities.upsert({
      supportIntegrationId: integration.id,
      subject: payload.sub,
      email: payload.email.trim().toLowerCase(),
      displayName: payload.display_name,
    });
    return {
      kind: 'PUBLIC',
      sub: requesterId,
      externalRequesterId: requesterId,
      supportIntegrationId: integration.id,
      jti: payload.jti,
    };
  }

  private async verifyWithActiveSecret(assertion: string, integrationId: string, issuer: string) {
    const secrets = await this.secrets.activeSecrets(integrationId);
    for (const credential of secrets) {
      try {
        const payload = verify(assertion, credential.secret, {
          algorithms: ['HS256'],
          issuer,
          audience: this.config.integrationAssertionAudience,
          maxAge: this.config.integrationAssertionMaxAgeSeconds,
          clockTolerance: 5,
        });
        if (isAssertionPayload(payload, integrationId) && this.hasBoundedLifetime(payload)) return payload;
      } catch {
        continue;
      }
    }
    throw new UnauthorizedException('Assertion invalide ou expirée.');
  }

  private hasBoundedLifetime(payload: IntegrationAssertionPayload): boolean {
    const now = Math.floor(Date.now() / 1000);
    return payload.iat <= now + 5 && payload.exp - payload.iat <= this.config.integrationAssertionMaxAgeSeconds;
  }

  private async consumeNonce(integrationId: string, jti: string, expiresAt: number): Promise<void> {
    const ttl = Math.max(1, expiresAt - Math.floor(Date.now() / 1000));
    try {
      const result = await this.redisProvider
        .getClient()
        .set(`public:assertion-nonce:${integrationId}:${jti}`, '1', 'EX', ttl, 'NX');
      if (result !== 'OK') throw new UnauthorizedException('Assertion déjà utilisée.');
    } catch (error: unknown) {
      if (error instanceof UnauthorizedException) throw error;
      throw new ServiceUnavailableException("L'échange sécurisé est temporairement indisponible.");
    }
  }
}

function isRoutingPayload(
  value: null | string | JwtPayload,
): value is JwtPayload & { iss: string; integration_id: string } {
  return (
    value !== null &&
    typeof value !== 'string' &&
    typeof value.iss === 'string' &&
    typeof value.integration_id === 'string'
  );
}

function isAssertionPayload(value: string | JwtPayload, integrationId: string): value is IntegrationAssertionPayload {
  return (
    typeof value !== 'string' &&
    typeof value.iss === 'string' &&
    typeof value.sub === 'string' &&
    value.sub.length <= 255 &&
    value.integration_id === integrationId &&
    typeof value.email === 'string' &&
    value.email.length <= 255 &&
    isEmail(value.email) &&
    typeof value.origin === 'string' &&
    value.origin.length <= 2048 &&
    typeof value.jti === 'string' &&
    value.jti.length <= 128 &&
    typeof value.iat === 'number' &&
    typeof value.exp === 'number' &&
    value.exp > value.iat &&
    (value.display_name === undefined || (typeof value.display_name === 'string' && value.display_name.length <= 160))
  );
}
