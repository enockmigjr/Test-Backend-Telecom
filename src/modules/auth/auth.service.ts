/**
 * ============================================================================
 * FICHIER : src/modules/auth/auth.service.ts
 * RÔLE : Service de gestion de l'authentification, de la sécurité et des sessions JWT.
 * EXPLICATION :
 * Ce service centralise l'ensemble des règles de sécurité et d'authentification :
 * 1. Authentification des utilisateurs (email/mot de passe avec hachage Argon2id).
 * 2. Génération et rotation sécurisée des paires de jetons (Access Token + Refresh Token).
 * 3. Gestion de la déconnexion avec mise en liste noire (blacklist) Redis par JTI et par utilisateur.
 * 4. Changement de mot de passe sécurisé et notification par email asynchrone.
 * ============================================================================
 */

import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
  Logger,
  Inject,
  ServiceUnavailableException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as argon2 from 'argon2';
import { createHash } from 'crypto';
import { eq, and, isNull } from 'drizzle-orm';
import { Queue } from 'bullmq';

import { generateUuid } from '../../common/helpers/uuidv7.helper';
import { DrizzleProvider } from '../../database/drizzle.provider';
import { RedisProvider } from '../../common/providers/redis.provider';
import { users, refreshTokens } from '../../database/schemas';
import { JwtConfigService } from '../../config/jwt.config';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { LoginResponse, TokenPair } from './interfaces/auth-response.interface';
import { RefreshSessionService } from './refresh-session.service';
import { AuthSessionRevokedEvent, AuthUserSessionsRevokedEvent } from './domain/auth-session.events';
import { acquireUserSessionLock } from './user-session-lock';

/**
 * Service centralisant la logique d'authentification et la gestion du cycle de vie des sessions.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly drizzle: DrizzleProvider,
    private readonly jwtService: JwtService,
    private readonly jwtConfig: JwtConfigService,
    private readonly redisProvider: RedisProvider,
    private readonly refreshSessions: RefreshSessionService,
    private readonly eventEmitter: EventEmitter2,
    @Inject('BullMQ_Queues') private readonly queues: { email: Queue; [key: string]: Queue },
  ) {}

  /**
   * Authentifie un utilisateur par email et mot de passe.
   *
   * @param email Email de l'utilisateur.
   * @param password Mot de passe brut envoyé dans le formulaire de connexion.
   * @param ipAddress Adresse IP de l'utilisateur pour le suivi de la session.
   * @param userAgent Identifiant du navigateur ou client HTTP.
   * @returns Un objet contenant les jetons de connexion et le profil utilisateur.
   * @throws UnauthorizedException si l'email ou le mot de passe est incorrect.
   * @throws ForbiddenException si le compte est désactivé.
   */
  async login(email: string, password: string, ipAddress: string, userAgent: string): Promise<LoginResponse> {
    const [user] = await this.drizzle.db
      .select()
      .from(users)
      .where(and(eq(users.email, email.toLowerCase().trim()), isNull(users.deletedAt)))
      .limit(1);

    if (!user) throw new UnauthorizedException('Identifiants invalides.');
    if (!user.isActive) throw new ForbiddenException('Ce compte est desactive. Contactez un administrateur.');

    const isPasswordValid = await argon2.verify(user.passwordHash, password);
    if (!isPasswordValid) throw new UnauthorizedException('Identifiants invalides.');

    await this.drizzle.db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));

    const tokens = await this.generateTokens(user, ipAddress, userAgent);

    const { departments } = await import('../../database/schemas/departments');
    const [department] = await this.drizzle.db
      .select({ name: departments.name })
      .from(departments)
      .where(eq(departments.id, user.departmentId))
      .limit(1);

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        departmentId: user.departmentId,
        departmentName: department?.name || 'Inconnu',
        mustChangePassword: user.mustChangePassword,
      },
    };
  }

  /**
   * Effectue la rotation d'un jeton de rafraîchissement (Refresh Token).
   *
   * @param refreshToken Le jeton de rafraîchissement actuel.
   * @param ipAddress Adresse IP de l'utilisateur.
   * @param userAgent User-Agent de la requête.
   * @returns La nouvelle paire de jetons d'accès et de rafraîchissement.
   */
  async refresh(refreshToken: string, ipAddress: string, userAgent: string): Promise<TokenPair> {
    const rotated = await this.refreshSessions.rotate(refreshToken, ipAddress, userAgent, (user) =>
      this.generateAccessToken(user),
    );
    const { accessToken } = rotated.finalized;
    return { accessToken, refreshToken: rotated.refreshToken, expiresIn: this.jwtConfig.accessExpirationSeconds };
  }

  /**
   * Déconnecte l'utilisateur de la session courante :
   * Révoque le refresh token correspondant en base de données et place le JTI de l'access token dans la liste noire Redis.
   *
   * @param refreshToken Jeton de rafraîchissement à révoquer.
   * @param jti Identifiant unique du jeton JWT à invalider.
   * @param userId Identifiant unique de l'utilisateur.
   */
  async logout(refreshToken: string, jti: string, userId: string): Promise<void> {
    const tokenHash = this.hashToken(refreshToken);
    await this.drizzle.runInTransaction(async () => {
      const [session] = await this.drizzle.db
        .select({ familyId: refreshTokens.familyId, userId: refreshTokens.userId })
        .from(refreshTokens)
        .where(eq(refreshTokens.tokenHash, tokenHash))
        .limit(1);
      if (!session || session.userId !== userId) return;

      await acquireUserSessionLock(this.drizzle.db, userId);
      await this.drizzle.db
        .update(refreshTokens)
        .set({ revokedAt: new Date() })
        .where(
          and(
            eq(refreshTokens.userId, userId),
            eq(refreshTokens.familyId, session.familyId),
            isNull(refreshTokens.revokedAt),
          ),
        );
    });

    await this.blacklistJti(jti);
    this.eventEmitter.emit('auth.session.revoked', new AuthSessionRevokedEvent(userId, jti));
  }

  /**
   * Déconnecte toutes les sessions actives d'un utilisateur sur l'ensemble de ses appareils.
   *
   * @param userId Identifiant unique de l'utilisateur.
   * @param jti Identifiant JTI facultatif du jeton actif à invalider immédiatement.
   */
  async logoutAll(userId: string, jti?: string): Promise<void> {
    await this.drizzle.runInTransaction(async () => {
      await acquireUserSessionLock(this.drizzle.db, userId);
      await this.drizzle.db
        .update(refreshTokens)
        .set({ revokedAt: new Date() })
        .where(and(eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt)));
    });

    // Invalider immédiatement le JTI du jeton actif dans Redis si fourni
    if (jti) {
      await this.blacklistJti(jti);
    }
    await this.blacklistUserSessions(userId);
    this.eventEmitter.emit('auth.user-sessions.revoked', new AuthUserSessionsRevokedEvent(userId));
  }

  /**
   * Modifie le mot de passe d'un utilisateur après vérification de l'ancien mot de passe.
   *
   * @param userId Identifiant de l'utilisateur.
   * @param currentPassword Ancien mot de passe saisi.
   * @param newPassword Nouveau mot de passe à enregistrer.
   * @throws UnauthorizedException si l'ancien mot de passe est invalide.
   */
  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const [user] = await this.drizzle.db.select().from(users).where(eq(users.id, userId)).limit(1);

    if (!user) throw new UnauthorizedException('Utilisateur non trouve.');

    const isCurrentPasswordValid = await argon2.verify(user.passwordHash, currentPassword);
    if (!isCurrentPasswordValid) throw new UnauthorizedException('Le mot de passe actuel est incorrect.');

    const newHash = await argon2.hash(newPassword, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });

    await this.drizzle.db
      .update(users)
      .set({ passwordHash: newHash, mustChangePassword: false })
      .where(eq(users.id, userId));

    this.sendPasswordChangedEmail(user.email, user.firstName).catch((err) => {
      this.logger.warn(`Echec envoi email confirmation changement mot de passe: ${(err as Error).message}`);
    });
  }

  /**
   * Empile une tâche d'envoi d'email de confirmation de changement de mot de passe dans BullMQ.
   */
  private async sendPasswordChangedEmail(to: string, firstName: string): Promise<void> {
    try {
      await this.queues.email.add('send-email', {
        to,
        subject: 'Votre mot de passe a ete modifie',
        template: 'passwordChanged',
        data: {
          firstName: firstName || 'Utilisateur',
          email: to,
          changeDate: new Date().toLocaleDateString('fr-FR', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          }),
        },
      });
    } catch (err) {
      this.logger.warn(`Email queue indisponible: ${(err as Error).message}`);
    }
  }

  /**
   * Inscrit l'identifiant de jeton JTI dans Redis avec une durée de vie (TTL) égale à l'expiration du jeton d'accès.
   */
  private async blacklistJti(jti: string): Promise<void> {
    try {
      const redis = this.redisProvider.getClient();
      const ttl = this.jwtConfig.accessExpirationSeconds;
      await redis.setex(`jwt_bl:${jti}`, ttl, '1');
    } catch (err) {
      this.logger.error(`Impossible de blacklister le JTI ${jti}: ${(err as Error).message}`);
      throw new ServiceUnavailableException('La révocation de session est temporairement indisponible.');
    }
  }

  /**
   * Inscrit une empreinte d'invalidation globale pour un utilisateur dans Redis afin de révoquer tous ses jetons actifs.
   */
  private async blacklistUserSessions(userId: string): Promise<void> {
    try {
      const redis = this.redisProvider.getClient();
      await redis.setex(`jwt_user_bl:${userId}`, this.jwtConfig.accessExpirationSeconds, String(Date.now()));
    } catch (err) {
      this.logger.error(`Impossible de révoquer les sessions de ${userId}: ${(err as Error).message}`);
      throw new ServiceUnavailableException('La révocation globale des sessions est temporairement indisponible.');
    }
  }

  /**
   * Génère un nouveau jeton d'accès JWT avec un identifiant JTI unique (UUIDv7).
   */
  private async generateAccessToken(
    user:
      | typeof users.$inferSelect
      | { id: string; email: string; role: string; departmentId: string; mustChangePassword: boolean },
  ): Promise<{ accessToken: string; jti: string }> {
    const jti = generateUuid();
    const revokedAfterRaw = await this.redisProvider.getClient().get(`jwt_user_bl:${user.id}`);
    const revokedAfter = revokedAfterRaw ? Number(revokedAfterRaw) : 0;
    const sessionIssuedAt = Math.max(Date.now(), Number.isFinite(revokedAfter) ? revokedAfter + 1 : 0);
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role as typeof users.$inferSelect.role,
      departmentId: user.departmentId,
      mustChangePassword: user.mustChangePassword,
      jti,
      sessionIssuedAt,
    };

    const accessToken = this.jwtService.sign(payload);

    return { accessToken, jti };
  }

  /**
   * Génère une paire complète de jetons (Access + Refresh) pour un utilisateur.
   */
  private async generateTokens(
    user: typeof users.$inferSelect,
    ipAddress: string,
    userAgent: string,
  ): Promise<TokenPair> {
    const { accessToken } = await this.generateAccessToken(user);

    const refreshToken = await this.refreshSessions.create(user.id, ipAddress, userAgent);
    return { accessToken, refreshToken, expiresIn: this.jwtConfig.accessExpirationSeconds };
  }

  /**
   * Calcule le dôme SHA-256 d'un jeton avant stockage en base de données.
   */
  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
