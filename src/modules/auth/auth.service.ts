import { Injectable, UnauthorizedException, Logger, Inject } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { generateUuid } from '../../common/helpers/uuidv7.helper';
import { createHash, randomBytes } from 'crypto';
import { eq, and, isNull } from 'drizzle-orm';
import { Queue } from 'bullmq';

import { DrizzleProvider } from '../../database/drizzle.provider';
import { RedisProvider } from '../../common/providers/redis.provider';
import { users, refreshTokens } from '../../database/schemas';
import { JwtConfigService } from '../../config/jwt.config';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { LoginResponse, TokenPair } from './interfaces/auth-response.interface';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly drizzle: DrizzleProvider,
    private readonly jwtService: JwtService,
    private readonly jwtConfig: JwtConfigService,
    private readonly redisProvider: RedisProvider,
    @Inject('BullMQ_Queues') private readonly queues: { email: Queue; [key: string]: Queue },
  ) {}

  async login(email: string, password: string, ipAddress: string, userAgent: string): Promise<LoginResponse> {
    const [user] = await this.drizzle.db
      .select()
      .from(users)
      .where(and(eq(users.email, email.toLowerCase().trim()), isNull(users.deletedAt)))
      .limit(1);

    if (!user) throw new UnauthorizedException('Identifiants invalides.');
    if (!user.isActive) throw new UnauthorizedException('Ce compte est desactive. Contactez un administrateur.');

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
      },
    };
  }

  async refresh(refreshToken: string, ipAddress: string, userAgent: string): Promise<TokenPair> {
    const tokenHash = this.hashToken(refreshToken);

    const [storedToken] = await this.drizzle.db
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.tokenHash, tokenHash))
      .limit(1);

    if (!storedToken || storedToken.revokedAt) throw new UnauthorizedException('Refresh token invalide ou revoque.');
    if (new Date() > storedToken.expiresAt) throw new UnauthorizedException('Refresh token expire.');

    await this.drizzle.db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokens.id, storedToken.id));

    const [user] = await this.drizzle.db
      .select()
      .from(users)
      .where(and(eq(users.id, storedToken.userId), isNull(users.deletedAt)))
      .limit(1);

    if (!user || !user.isActive) throw new UnauthorizedException('Utilisateur non trouve ou desactive.');

    return this.generateTokens(user, ipAddress, userAgent);
  }

  /**
   * Deconnecte l utilisateur : revoque le refresh token en DB ET blackliste
   * l access token dans Redis (cle individuelle jwt_bl:{jti} avec TTL).
   */
  async logout(refreshToken: string, jti: string): Promise<void> {
    const tokenHash = this.hashToken(refreshToken);
    await this.drizzle.db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokens.tokenHash, tokenHash));

    await this.blacklistJti(jti);
  }

  /**
   * Deconnecte toutes les sessions : revoque tous les refresh tokens.
   * Les access tokens actifs expirent naturellement (TTL 15 min max).
   */
  async logoutAll(userId: string): Promise<void> {
    await this.drizzle.db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt)));
  }

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

  private async sendPasswordChangedEmail(to: string, firstName: string): Promise<void> {
    try {
      await this.queues.email.add('send-email', {
        to,
        subject: 'Votre mot de passe a ete modifie',
        template: 'passwordChanged',
        data: {
          firstName: firstName || 'Utilisateur',
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
   * Blackliste un JTI dans Redis avec TTL individuel.
   * Cle : jwt_bl:{jti} — expire automatiquement avec le token.
   * Non-bloquant : en cas d indisponibilite Redis, le token expire naturellement.
   */
  private async blacklistJti(jti: string): Promise<void> {
    try {
      const redis = this.redisProvider.getClient();
      const ttl = this.jwtConfig.accessExpirationSeconds;
      await redis.setex(`jwt_bl:${jti}`, ttl, '1');
    } catch (err) {
      this.logger.warn(`Impossible de blacklister le JTI ${jti}: ${(err as Error).message}`);
    }
  }

  private async generateTokens(
    user: typeof users.$inferSelect,
    ipAddress: string,
    userAgent: string,
  ): Promise<TokenPair> {
    const jti = generateUuid();
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      departmentId: user.departmentId,
      jti,
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.jwtConfig.accessSecret,
      expiresIn: this.jwtConfig.accessExpiration,
    });

    const rawRefreshToken = randomBytes(48).toString('hex');
    const tokenHash = this.hashToken(rawRefreshToken);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.drizzle.db
      .insert(refreshTokens)
      .values({ id: generateUuid(), userId: user.id, tokenHash, userAgent, ipAddress, expiresAt });

    return { accessToken, refreshToken: rawRefreshToken };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
