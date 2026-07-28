import { Injectable, UnauthorizedException } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import { createHash, randomBytes } from 'crypto';

import { generateUuid } from '../../common/helpers/uuidv7.helper';
import { DrizzleProvider } from '../../database/drizzle.provider';
import { refreshTokens, users } from '../../database/schemas';
import { JwtConfigService } from '../../config/jwt.config';
import { acquireUserSessionLock } from './user-session-lock';

type AuthUser = typeof users.$inferSelect;
type DatabaseTransaction = Parameters<Parameters<DrizzleProvider['db']['transaction']>[0]>[0];

interface RotatedSession {
  readonly refreshToken: string;
  readonly user: AuthUser;
}

type RotationOutcome =
  | { readonly status: 'rotated'; readonly session: RotatedSession & { readonly finalized?: unknown } }
  | { readonly status: 'invalid' };

@Injectable()
export class RefreshSessionService {
  constructor(
    private readonly drizzle: DrizzleProvider,
    private readonly jwtConfig: JwtConfigService,
  ) {}

  async create(userId: string, ipAddress: string, userAgent: string): Promise<string> {
    const session = this.newSession(userId, ipAddress, userAgent);
    await this.drizzle.db.insert(refreshTokens).values(session.record);
    return session.rawToken;
  }

  async rotate(rawToken: string, ipAddress: string, userAgent: string): Promise<RotatedSession>;
  async rotate<T>(
    rawToken: string,
    ipAddress: string,
    userAgent: string,
    finalize: (user: AuthUser) => Promise<T>,
  ): Promise<RotatedSession & { readonly finalized: T }>;
  async rotate(
    rawToken: string,
    ipAddress: string,
    userAgent: string,
    finalize?: (user: AuthUser) => Promise<unknown>,
  ): Promise<RotatedSession & { readonly finalized?: unknown }> {
    const tokenHash = this.hashToken(rawToken);
    const outcome = await this.drizzle.db.transaction<RotationOutcome>(async (transaction) => {
      const [tokenOwner] = await transaction
        .select({ userId: refreshTokens.userId })
        .from(refreshTokens)
        .where(eq(refreshTokens.tokenHash, tokenHash))
        .limit(1);

      if (!tokenOwner) return { status: 'invalid' };
      await acquireUserSessionLock(transaction, tokenOwner.userId);

      const [storedToken] = await transaction
        .select()
        .from(refreshTokens)
        .where(eq(refreshTokens.tokenHash, tokenHash))
        .limit(1);

      if (!storedToken || storedToken.userId !== tokenOwner.userId) return { status: 'invalid' };

      if (storedToken.revokedAt) {
        await this.revokeFamilySessions(transaction, storedToken.familyId);
        return { status: 'invalid' };
      }

      if (storedToken.ipAddress !== ipAddress || storedToken.userAgent !== userAgent) {
        await this.revokeFamilySessions(transaction, storedToken.familyId);
        return { status: 'invalid' };
      }

      if (storedToken.expiresAt.getTime() <= Date.now()) {
        await transaction
          .update(refreshTokens)
          .set({ revokedAt: new Date() })
          .where(and(eq(refreshTokens.id, storedToken.id), isNull(refreshTokens.revokedAt)));
        return { status: 'invalid' };
      }

      const [user] = await transaction
        .select()
        .from(users)
        .where(and(eq(users.id, storedToken.userId), isNull(users.deletedAt)))
        .limit(1);

      if (!user || !user.isActive) {
        await this.revokeFamilySessions(transaction, storedToken.familyId);
        return { status: 'invalid' };
      }

      const [consumed] = await transaction
        .update(refreshTokens)
        .set({ revokedAt: new Date() })
        .where(and(eq(refreshTokens.id, storedToken.id), isNull(refreshTokens.revokedAt)))
        .returning({ id: refreshTokens.id });

      if (!consumed) {
        await this.revokeFamilySessions(transaction, storedToken.familyId);
        return { status: 'invalid' };
      }

      const next = this.newSession(user.id, ipAddress, userAgent, storedToken.familyId);
      await transaction.insert(refreshTokens).values(next.record);
      const session = finalize
        ? { refreshToken: next.rawToken, user, finalized: await finalize(user) }
        : { refreshToken: next.rawToken, user };
      return { status: 'rotated', session };
    });

    if (outcome.status === 'invalid') {
      throw new UnauthorizedException('Refresh token invalide, expire ou reutilise.');
    }
    return outcome.session;
  }

  private newSession(userId: string, ipAddress: string, userAgent: string, familyId = generateUuid()) {
    const rawToken = randomBytes(48).toString('hex');
    return {
      rawToken,
      record: {
        id: generateUuid(),
        familyId,
        userId,
        tokenHash: this.hashToken(rawToken),
        userAgent,
        ipAddress,
        expiresAt: new Date(Date.now() + this.jwtConfig.refreshExpirationSeconds * 1000),
      },
    };
  }

  private async revokeFamilySessions(transaction: DatabaseTransaction, familyId: string): Promise<void> {
    await transaction
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(refreshTokens.familyId, familyId), isNull(refreshTokens.revokedAt)));
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
