/**
 * Stratégie Passport JWT — Keycloak uniquement (RS256 via JWKS).
 * 1. Résout la clé publique du realm (JWKS) depuis le `kid` du jeton.
 * 2. Vérifie la signature, l'expiration et l'issuer via Passport/jsonwebtoken.
 * 3. Contrôle la révocation Redis (`jwt_bl:{jti}`, `jwt_user_bl:{sub}`).
 * 4. Lie le profil métier via `users.keycloakSubjectId` (ou par email vérifié
 *    au premier login) et retourne le contexte utilisateur.
 */

import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { DrizzleProvider } from '../../../database/drizzle.provider';
import { RedisProvider } from '../../../common/providers/redis.provider';
import { users } from '../../../database/schemas';
import { eq, and, isNull } from 'drizzle-orm';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { KeycloakTokenVerifierService } from '../services/keycloak-token-verifier.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(
    private readonly drizzle: DrizzleProvider,
    private readonly redisProvider: RedisProvider,
    private readonly tokenVerifier: KeycloakTokenVerifierService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      // Keycloak est l'unique fournisseur : aucun algorithme local (anti alg-confusion).
      algorithms: ['RS256'],
      secretOrKeyProvider: (
        _request: unknown,
        rawJwtToken: string,
        done: (error: Error | null, secretOrKey?: string) => void,
      ) => {
        this.tokenVerifier
          .publicKeyForToken(rawJwtToken)
          .then((publicKey) => done(null, publicKey))
          .catch((error: unknown) =>
            done(error instanceof Error ? error : new Error('Échec de résolution de la clé Keycloak.')),
          );
      },
    });
  }

  async validate(payload: JwtPayload) {
    if (await this.isRevoked(payload)) {
      throw new UnauthorizedException('Token révoqué.');
    }
    return this.validateKeycloak(payload);
  }

  /** Valide un jeton Keycloak : rôle depuis realm_access, profil métier lié par keycloakSubjectId. */
  private async validateKeycloak(payload: JwtPayload) {
    const subject = payload.sub;
    const profile = await this.findProfileBySubject(subject);
    const user = profile ?? (await this.bindProfileByEmail(payload, subject));
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Profil métier introuvable pour ce compte SSO.');
    }
    const roles = this.extractRealmRoles(payload);
    const role = roles.length > 0 ? roles[0] : user.role;
    return {
      sub: user.id,
      id: user.id,
      email: user.email,
      role,
      departmentId: user.departmentId,
      mustChangePassword: user.mustChangePassword,
      jti: payload.jti,
      sessionIssuedAt: undefined,
    };
  }

  private async findProfileBySubject(subject: string) {
    const [user] = await this.drizzle.db
      .select({
        id: users.id,
        email: users.email,
        role: users.role,
        departmentId: users.departmentId,
        isActive: users.isActive,
        mustChangePassword: users.mustChangePassword,
      })
      .from(users)
      .where(and(eq(users.keycloakSubjectId, subject), isNull(users.deletedAt)))
      .limit(1);
    return user;
  }

  /**
   * Premier login SSO : lie le profil métier existant au sujet Keycloak via l'email
   * vérifié par le fournisseur (jamais de création silencieuse).
   */
  private async bindProfileByEmail(payload: JwtPayload, subject: string) {
    const record = payload as unknown as Record<string, unknown>;
    const email = typeof record['email'] === 'string' ? record['email'].toLowerCase().trim() : '';
    const emailVerified = record['email_verified'] !== false;
    if (!email || !emailVerified) return undefined;
    const [user] = await this.drizzle.db
      .select({
        id: users.id,
        email: users.email,
        role: users.role,
        departmentId: users.departmentId,
        isActive: users.isActive,
        mustChangePassword: users.mustChangePassword,
      })
      .from(users)
      .where(and(eq(users.email, email), isNull(users.deletedAt)))
      .limit(1);
    if (!user) return undefined;
    await this.drizzle.db.update(users).set({ keycloakSubjectId: subject }).where(eq(users.id, user.id));
    return user;
  }

  /** Extrait les rôles métier du claim realm_access (Keycloak). */
  private extractRealmRoles(payload: JwtPayload): string[] {
    const record = payload as unknown as Record<string, unknown>;
    const realmAccess = record['realm_access'];
    if (!realmAccess || typeof realmAccess !== 'object' || Array.isArray(realmAccess)) return [];
    const roles = (realmAccess as Record<string, unknown>)['roles'];
    if (!Array.isArray(roles)) return [];
    return roles.filter(
      (role): role is string =>
        typeof role === 'string' &&
        !role.startsWith('default-roles-') &&
        role !== 'offline_access' &&
        role !== 'uma_authorization',
    );
  }

  /**
   * Vérifie la révocation dans Redis. Fail-open par défaut (configurable) :
   * un jeton à signature valide et non expiré reste accepté si Redis est
   * indisponible, plutôt que de faire tomber toute l'API en 500.
   */
  private async isRevoked(payload: JwtPayload): Promise<boolean> {
    const redis = this.redisProvider.getClient();
    try {
      const [isRevokedByJti, userRevokedAfterRaw] = await Promise.all([
        this.withRedisTimeout(() => redis.exists(`jwt_bl:${payload.jti}`)),
        this.withRedisTimeout(() => redis.get(`jwt_user_bl:${payload.sub}`)),
      ]);
      const userRevokedAfter = userRevokedAfterRaw ? Number(userRevokedAfterRaw) : null;
      const revokedByLogoutAll =
        userRevokedAfter !== null &&
        Number.isFinite(userRevokedAfter) &&
        (!payload.sessionIssuedAt || payload.sessionIssuedAt <= userRevokedAfter);
      return isRevokedByJti === 1 || revokedByLogoutAll;
    } catch (error: unknown) {
      if (this.failOpenBlacklist()) {
        this.logger.warn('Redis indisponible : contrôle de révocation JWT contourné (fail-open).');
        return false;
      }
      throw error;
    }
  }

  private failOpenBlacklist(): boolean {
    return process.env['AUTH_REDIS_BLACKLIST_FAIL_OPEN'] !== 'false';
  }

  /**
   * Borne chaque commande Redis à 1 s : le client partagé (BullMQ) a
   * `maxRetriesPerRequest: null`, sinon une panne Redis ferait attendre
   * indéfiniment chaque requête avant le repli fail-open.
   */
  private async withRedisTimeout<T>(run: () => Promise<T>, timeoutMs = 1000): Promise<T> {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('REDIS_TIMEOUT')), timeoutMs);
    });
    try {
      return await Promise.race([run(), timeout]);
    } finally {
      clearTimeout(timer);
    }
  }
}
