/**
 * Récupère et met en cache les clés publiques (JWKS) du realm Keycloak,
 * et convertit la clé x5c en PEM pour la vérification RS256 (jsonwebtoken).
 */
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';

interface Jwk {
  readonly kid?: string;
  readonly alg?: string;
  readonly x5c?: string[];
}

interface JwksPayload {
  readonly keys: Jwk[];
}

const CACHE_TTL_MS = 10 * 60 * 1000;

@Injectable()
export class KeycloakJwksService {
  private readonly logger = new Logger(KeycloakJwksService.name);
  private cache: { keys: Map<string, string>; expiresAt: number } | null = null;

  /** Renvoie la clé publique PEM correspondant au kid du jeton. */
  async publicKey(kid?: string): Promise<string> {
    const keys = await this.loadKeys();
    const key = kid ? keys.get(kid) : undefined;
    if (!key) {
      throw new UnauthorizedException('Clé de signature Keycloak introuvable.');
    }
    return key;
  }

  private async loadKeys(): Promise<Map<string, string>> {
    if (this.cache && this.cache.expiresAt > Date.now()) return this.cache.keys;
    const issuer = process.env['KEYCLOAK_ISSUER'];
    if (!issuer) {
      throw new UnauthorizedException('KEYCLOAK_ISSUER non configuré.');
    }
    const response = await fetch(`${issuer}/protocol/openid-connect/certs`, {
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) {
      throw new UnauthorizedException('Impossible de récupérer les clés Keycloak.');
    }
    const payload = (await response.json()) as JwksPayload;
    const keys = new Map<string, string>();
    for (const jwk of payload.keys ?? []) {
      if (jwk.kid && jwk.x5c?.[0]) {
        keys.set(jwk.kid, certToPem(jwk.x5c[0]));
      }
    }
    this.cache = { keys, expiresAt: Date.now() + CACHE_TTL_MS };
    this.logger.log(`Clés Keycloak rafraîchies (${keys.size} clés).`);
    return keys;
  }
}

function certToPem(x5c: string): string {
  const body = x5c.match(/.{1,64}/g)?.join('\n') ?? x5c;
  return `-----BEGIN CERTIFICATE-----\n${body}\n-----END CERTIFICATE-----`;
}
