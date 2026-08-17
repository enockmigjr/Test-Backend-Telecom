/**
 * Vérificateur partagé des jetons Keycloak (RS256 via JWKS).
 * Utilisé par la stratégie Passport HTTP et par l'authentification WebSocket
 * afin de garantir une seule source de vérité pour la validation de signature.
 */
import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';

import { KeycloakJwksService } from './keycloak-jwks.service';

interface DecodedHeader {
  readonly alg?: string;
  readonly kid?: string;
}

@Injectable()
export class KeycloakTokenVerifierService {
  constructor(private readonly keycloakJwks: KeycloakJwksService) {}

  /** Résout la clé publique JWKS correspondant au jeton (kid + algorithme RS256). */
  async publicKeyForToken(token: string): Promise<string> {
    const header = this.decodeHeader(token);
    if (header.alg !== 'RS256') {
      throw new UnauthorizedException('Algorithme de signature JWT non autorisé.');
    }
    return this.keycloakJwks.publicKey(header.kid);
  }

  /** Vérifie la signature RS256 du jeton et renvoie le payload décodé. */
  async verify<T extends object>(token: string): Promise<T> {
    const publicKey = await this.publicKeyForToken(token);
    try {
      return jwt.verify(token, publicKey, { algorithms: ['RS256'] }) as T;
    } catch {
      throw new UnauthorizedException('Jeton Keycloak invalide ou expiré.');
    }
  }

  private decodeHeader(token: string): DecodedHeader {
    const decoded = jwt.decode(token, { complete: true });
    if (!decoded || typeof decoded !== 'object') {
      throw new UnauthorizedException('Jeton JWT illisible.');
    }
    return {
      alg: decoded.header.alg,
      kid: decoded.header.kid,
    };
  }
}
