/**
 * ============================================================================
 * FICHIER : src/websocket/websocket-auth.service.ts
 * RÔLE : Service d'authentification et de sécurité pour la passerelle WebSocket Socket.IO.
 * EXPLICATION :
 * Ce service valide l'identité des clients lors de la poignée de main (Handshake) WebSocket :
 * 1. Extrait le jeton d'accès JWT depuis l'en-tête de cookie HTTP `Cookie: __Host-access-token=...`.
 * 2. Vérifie la signature cryptographique et l'expiration du jeton via `JwtService.verifyAsync`.
 * 3. Invoque `JwtStrategy.validate` pour contrôler les listes de révocation Redis et le statut de l'utilisateur dans PostgreSQL.
 * 4. Applique la politique de changement de mot de passe (`assertPasswordChangeComplete`) interdisant l'accès WebSocket aux utilisateurs devant changer leur mot de passe temporaire.
 * ============================================================================
 */

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { JwtPayload } from '../modules/auth/interfaces/jwt-payload.interface';
import { JwtStrategy } from '../modules/auth/strategies/jwt.strategy';
import { assertPasswordChangeComplete } from '../modules/auth/password-change-policy';

/**
 * Service assurant le contrôle d'accès et la validation des jetons JWT pour les connexions WebSocket.
 */
@Injectable()
export class WebSocketAuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly jwtStrategy: JwtStrategy,
  ) {}

  /**
   * Authentifie une tentative de connexion WebSocket à partir de la chaîne de cookies de poignée de main (Handshake).
   *
   * @param cookieHeader La chaîne brute transmise dans `client.handshake.headers.cookie`.
   * @returns Le payload utilisateur validé contenant `sub`, `email`, `role`, `departmentId`, `jti`.
   * @throws UnauthorizedException Si le cookie est absent, si le JWT est expiré/révoqué ou si l'utilisateur est inactif.
   */
  async authenticate(cookieHeader: string | undefined): Promise<JwtPayload> {
    // 1. Extraire le jeton de session depuis les cookies HTTP
    const token = this.extractAccessToken(cookieHeader);
    if (!token) throw new UnauthorizedException('Cookie de session absent.');

    // 2. Vérifier la signature du jeton et sa date d'expiration
    const payload = await this.jwtService.verifyAsync<JwtPayload>(token);

    // 3. Valider la non-révocation dans Redis et l'état actif dans PostgreSQL
    const user = await this.jwtStrategy.validate(payload);

    // 4. Bloquer la connexion WebSocket si l'utilisateur doit changer son mot de passe initial
    assertPasswordChangeComplete(user);

    return user;
  }

  /**
   * Découpe et extrait la valeur décodée du cookie de session d'accès.
   *
   * @param cookieHeader Chaîne brute des cookies séparés par des points-virgules.
   * @returns La valeur du jeton d'accès ou `null` si non trouvé ou malformé.
   */
  private extractAccessToken(cookieHeader: string | undefined): string | null {
    if (!cookieHeader) return null;
    const cookieName = this.accessCookieName();
    const values = cookieHeader
      .split(';')
      .map((part) => part.trim())
      .filter((part) => part.startsWith(`${cookieName}=`))
      .map((part) => part.slice(cookieName.length + 1));

    if (values.length !== 1 || !values[0]) return null;
    try {
      return decodeURIComponent(values[0]);
    } catch {
      return null;
    }
  }

  /**
   * Détermine le nom canonique du cookie de session selon l'environnement.
   * En production, impose le préfixe de sécurité `__Host-` empêchant le détournement par sous-domaines.
   */
  private accessCookieName(): string {
    const configured = process.env['AUTH_ACCESS_COOKIE_NAME'];
    if (process.env['NODE_ENV'] !== 'production') return configured || 'access_token';

    const name = configured || '__Host-access-token';
    if (!name.startsWith('__Host-')) {
      throw new Error('AUTH_ACCESS_COOKIE_NAME doit utiliser le préfixe __Host- en production.');
    }
    return name;
  }
}
