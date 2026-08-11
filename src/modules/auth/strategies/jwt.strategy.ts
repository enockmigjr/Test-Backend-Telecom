/**
 * ============================================================================
 * FICHIER : src/modules/auth/strategies/jwt.strategy.ts
 * RÔLE : Stratégie d'authentification Passport JWT (JSON Web Token).
 * EXPLICATION :
 * Cette stratégie intercepte l'en-tête HTTP `Authorization: Bearer <token>` sur chaque route protégée :
 * 1. Valide la signature cryptographique du jeton d'accès via la clé secrète `accessSecret`.
 * 2. Vérifie dans Redis si le jeton individuel (`jti`) a été révoqué (`jwt_bl:{jti}`).
 * 3. Vérifie si toutes les sessions de l'utilisateur ont été invalidées via `logoutAll` (`jwt_user_bl:{sub}`).
 * 4. Interroge la base PostgreSQL pour s'assurer que l'utilisateur existe toujours et que son compte n'est ni désactivé (`isActive = false`) ni supprimé (`deletedAt IS NOT NULL`).
 * ============================================================================
 */

import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtConfigService } from '../../../config/jwt.config';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { DrizzleProvider } from '../../../database/drizzle.provider';
import { RedisProvider } from '../../../common/providers/redis.provider';
import { users } from '../../../database/schemas';
import { eq, and, isNull } from 'drizzle-orm';

/**
 * Stratégie Passport validant les requêtes HTTP protégées par jetons JWT.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(
    private readonly jwtConfig: JwtConfigService,
    private readonly drizzle: DrizzleProvider,
    private readonly redisProvider: RedisProvider,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtConfig.accessSecret,
    });
  }

  /**
   * Valide le jeton décodé, vérifie sa non-révocation dans Redis et contrôle la validité du compte utilisateur.
   *
   * @param payload Données décodées contenues dans le jeton d'accès.
   * @returns L'objet utilisateur injecté dans `request.user`.
   * @throws UnauthorizedException (401) si le jeton est révoqué ou l'utilisateur inactif.
   */
  async validate(payload: JwtPayload) {
    if (await this.isRevoked(payload)) {
      throw new UnauthorizedException('Token révoqué.');
    }

    // 2. Contrôle de l'existence et du statut du compte dans PostgreSQL
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
      .where(and(eq(users.id, payload.sub), isNull(users.deletedAt)))
      .limit(1);

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Utilisateur non trouvé ou désactivé.');
    }

    // 3. Retourne le contexte utilisateur pour les guards et contrôleurs
    return {
      sub: user.id,
      id: user.id,
      email: user.email,
      role: user.role,
      departmentId: user.departmentId,
      mustChangePassword: user.mustChangePassword,
      jti: payload.jti,
      sessionIssuedAt: payload.sessionIssuedAt,
    };
  }

  /**
   * Vérifie la révocation dans Redis. Fail-open par défaut (configurable) :
   * un jeton à signature valide et non expiré reste accepté si Redis est
   * indisponible, plutôt que de faire tomber toute l'API en 500.
   */
  private async isRevoked(payload: JwtPayload): Promise<boolean> {
    const redis = this.redisProvider.getClient();
    try {
      const [isRevokedNew, isRevokedLegacy, userRevokedAfterRaw] = await Promise.all([
        this.withRedisTimeout(() => redis.exists(`jwt_bl:${payload.jti}`)),
        this.withRedisTimeout(() => redis.sismember('jwt_blacklist', payload.jti)),
        this.withRedisTimeout(() => redis.get(`jwt_user_bl:${payload.sub}`)),
      ]);
      const userRevokedAfter = userRevokedAfterRaw ? Number(userRevokedAfterRaw) : null;
      const revokedByLogoutAll =
        userRevokedAfter !== null &&
        Number.isFinite(userRevokedAfter) &&
        (!payload.sessionIssuedAt || payload.sessionIssuedAt <= userRevokedAfter);
      return isRevokedNew === 1 || isRevokedLegacy === 1 || revokedByLogoutAll;
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
