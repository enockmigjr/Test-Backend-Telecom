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
import * as jwt from 'jsonwebtoken';
import { JwtConfigService } from '../../../config/jwt.config';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { KeycloakJwksService } from '../services/keycloak-jwks.service';
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
  private static readonly BUSINESS_ROLES = [
    'ADMINISTRATOR',
    'SUPERVISOR',
    'CUSTOMER_SERVICE_AGENT',
    'NOC_ENGINEER',
    'BILLING_AGENT',
    'TECHNICAL_SUPPORT_ENGINEER',
    'FIELD_TECHNICIAN',
  ] as const;

  constructor(
    private readonly jwtConfig: JwtConfigService,
    private readonly drizzle: DrizzleProvider,
    private readonly redisProvider: RedisProvider,
    private readonly keycloakJwks: KeycloakJwksService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      // Allowlist stricte : aucun algorithme de signature non prévu (anti alg-confusion).
      algorithms: ['HS256', 'RS256'],
      // HS256 = jetons applicatifs ; RS256 = jetons Keycloak (clés publiques du realm).
      // passport-jwt attend un callback `done` : une promesse retournée sans appel
      // de callback laisserait chaque requête authentifiée en attente indéfiniment.
      secretOrKeyProvider: (
        _request: unknown,
        rawJwtToken: string,
        done: (error: Error | null, secretOrKey?: string) => void,
      ) => {
        void (async () => {
          try {
            const decoded = jwt.decode(rawJwtToken, { complete: true });
            const header = decoded && typeof decoded === 'object' ? decoded.header : undefined;
            if (header?.alg === 'RS256') {
              done(null, await this.keycloakJwks.publicKey(header.kid));
              return;
            }
            done(null, this.jwtConfig.accessSecret);
          } catch (error) {
            done(error instanceof Error ? error : new Error('Échec de résolution de la clé JWT.'));
          }
        })();
      },
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
    if (this.isKeycloakToken(payload)) {
      return this.validateKeycloak(payload);
    }
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

  /** Jeton émis par le realm Keycloak (issuer configuré, comparaison exacte). */
  private isKeycloakToken(payload: JwtPayload): boolean {
    const issuer = process.env['KEYCLOAK_ISSUER'];
    return Boolean(
      issuer && typeof payload['iss'] === 'string' && payload['iss'].replace(/\/$/, '') === issuer.replace(/\/$/, ''),
    );
  }

  /** Valide un jeton Keycloak : rôle depuis realm_access, profil métier lié par keycloakSubjectId. */
  private async validateKeycloak(payload: JwtPayload) {
    const subject = payload.sub;
    const profile = await this.findProfileBySubject(subject);
    const user = profile ?? (await this.bindProfileByEmail(payload, subject));
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Profil métier introuvable pour ce compte SSO.');
    }
    // Les jetons contiennent aussi `default-roles-telecom`, `offline_access` et
    // `uma_authorization` : on ne garde que le rôle métier réel (les 7 rôles du
    // système), sinon `roles[0]` peut valoir `default-roles-telecom` → 403 partout.
    const roles = this.extractRealmRoles(payload);
    const businessRole = roles.find((role) =>
      (JwtStrategy.BUSINESS_ROLES as readonly string[]).includes(role),
    );
    const role = businessRole ?? user.role;
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
    const email = typeof payload['email'] === 'string' ? payload['email'].toLowerCase().trim() : '';
    const emailVerified = payload['email_verified'] !== false;
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
    return Array.isArray(roles) ? roles.filter((role): role is string => typeof role === 'string') : [];
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
