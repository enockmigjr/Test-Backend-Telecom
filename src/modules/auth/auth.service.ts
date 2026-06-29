import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { generateUuid } from '../../common/helpers/uuidv7.helper';
import { createHash, randomBytes } from 'crypto';
import { eq, and, isNull } from 'drizzle-orm';

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
  ) {}

  /**
   * Authentifie un utilisateur et génère les tokens.
   */
  async login(email: string, password: string, ipAddress: string, userAgent: string): Promise<LoginResponse> {
    const [user] = await this.drizzle.db
      .select()
      .from(users)
      .where(and(eq(users.email, email.toLowerCase().trim()), isNull(users.deletedAt)))
      .limit(1);

    if (!user) {
      throw new UnauthorizedException('Identifiants invalides.');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Ce compte est désactivé. Contactez un administrateur.');
    }

    const isPasswordValid = await argon2.verify(user.passwordHash, password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Identifiants invalides.');
    }

    // Mettre à jour lastLoginAt
    await this.drizzle.db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));

    const tokens = await this.generateTokens(user, ipAddress, userAgent);

    // Récupérer le nom du département
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

  /**
   * Rafraîchit la paire de tokens (rotation).
   */
  async refresh(refreshToken: string, ipAddress: string, userAgent: string): Promise<TokenPair> {
    const tokenHash = this.hashToken(refreshToken);

    const [storedToken] = await this.drizzle.db
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.tokenHash, tokenHash))
      .limit(1);

    if (!storedToken || storedToken.revokedAt) {
      throw new UnauthorizedException('Refresh token invalide ou révoqué.');
    }

    if (new Date() > storedToken.expiresAt) {
      throw new UnauthorizedException('Refresh token expiré.');
    }

    // Révoquer l'ancien token
    await this.drizzle.db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokens.id, storedToken.id));

    // Récupérer l'utilisateur
    const [user] = await this.drizzle.db
      .select()
      .from(users)
      .where(and(eq(users.id, storedToken.userId), isNull(users.deletedAt)))
      .limit(1);

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Utilisateur non trouvé ou désactivé.');
    }

    return this.generateTokens(user, ipAddress, userAgent);
  }

  /**
   * Déconnecte l'utilisateur (révoque un refresh token spécifique).
   */
  async logout(refreshToken: string): Promise<void> {
    const tokenHash = this.hashToken(refreshToken);
    await this.drizzle.db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokens.tokenHash, tokenHash));
  }

  /**
   * Déconnecte toutes les sessions actives de l'utilisateur.
   */
  async logoutAll(userId: string): Promise<void> {
    await this.drizzle.db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt)));
  }

  /**
   * Change le mot de passe de l'utilisateur connecté.
   */
  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const [user] = await this.drizzle.db.select().from(users).where(eq(users.id, userId)).limit(1);

    if (!user) {
      throw new UnauthorizedException('Utilisateur non trouvé.');
    }

    const isCurrentPasswordValid = await argon2.verify(user.passwordHash, currentPassword);
    if (!isCurrentPasswordValid) {
      throw new UnauthorizedException('Le mot de passe actuel est incorrect.');
    }

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
  }

  /**
   * Génère une paire de tokens (access + refresh).
   */
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

    // Générer et stocker le refresh token
    const rawRefreshToken = randomBytes(48).toString('hex');
    const tokenHash = this.hashToken(rawRefreshToken);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 jours

    await this.drizzle.db.insert(refreshTokens).values({
      id: generateUuid(),
      userId: user.id,
      tokenHash,
      userAgent,
      ipAddress,
      expiresAt,
    });

    return { accessToken, refreshToken: rawRefreshToken };
  }

  /**
   * Hash un token pour stockage sécurisé (SHA-256).
   */
  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
