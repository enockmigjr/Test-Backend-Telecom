/**
 * ============================================================================
 * FICHIER : src/modules/auth/refresh-session.service.ts
 * RÔLE : Service de rotation atomique et sécurisée des jetons de rafraîchissement (Refresh Token Rotation).
 * EXPLICATION :
 * Ce service gère la sécurité avancée des sessions utilisateurs à travers le mécanisme de "Famille de Jetons" (Token Family) :
 * 1. `create` : Génère un jeton aléatoire de 48 octets cryptographiques (`crypto.randomBytes`), stocke son dôme SHA-256 dans PostgreSQL avec l'IP et le User-Agent du client.
 * 2. `rotate` : Exécute une rotation atomique à l'intérieur d'une transaction PostgreSQL protégée par un verrou d'accès concurrentiel (`acquireUserSessionLock`) :
 *    - **Détection de Vol / Réutilisation** : Si un jeton déjà consommé (`revokedAt NOT NULL`) est à nouveau présenté, la totalité de la famille de jetons (`familyId`) est révoquée immédiatement pour contrer les attaques de rejeu.
 *    - **Empreinte de Contexte** : Vérifie que l'adresse IP et l'en-tête User-Agent correspondent au jeton original. Toute déviation révoque l'ensemble de la famille de jetons.
 *    - En cas de succès, le jeton actuel est marqué comme révoqué et un nouveau jeton est émis dans la même famille.
 * ============================================================================
 */

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

/** Structure d'une session renouvelée contenant le nouveau jeton et l'utilisateur. */
interface RotatedSession {
  readonly refreshToken: string;
  readonly user: AuthUser;
}

/** Discriminated union décrivant l'issue de la transaction de rotation. */
type RotationOutcome =
  | { readonly status: 'rotated'; readonly session: RotatedSession & { readonly finalized?: unknown } }
  | { readonly status: 'invalid' };

/**
 * Service orchestrant la persistance transactionnelle des jetons de rafraîchissement.
 */
@Injectable()
export class RefreshSessionService {
  constructor(
    private readonly drizzle: DrizzleProvider,
    private readonly jwtConfig: JwtConfigService,
  ) {}

  /**
   * Génère et persiste une nouvelle session initiale de rafraîchissement.
   *
   * @param userId Identifiant UUIDv7 de l'utilisateur.
   * @param ipAddress Adresse IP source du client.
   * @param userAgent Signature User-Agent du client HTTP.
   * @returns Le jeton de rafraîchissement brut en hexadécimal (transmis au client).
   */
  async create(userId: string, ipAddress: string, userAgent: string): Promise<string> {
    const session = this.newSession(userId, ipAddress, userAgent);
    await this.drizzle.db.insert(refreshTokens).values(session.record);
    return session.rawToken;
  }

  /**
   * Effectue la rotation sécurisée d'un jeton de rafraîchissement existant.
   *
   * @param rawToken Jeton de rafraîchissement brut reçu du client.
   * @param ipAddress Adresse IP de la requête de renouvellement.
   * @param userAgent User-Agent de la requête de renouvellement.
   * @param finalize Fonction callback facultative pour générer les jetons d'accès complémentaires.
   * @returns La session renouvelée avec le nouveau jeton de rafraîchissement.
   * @throws UnauthorizedException si le jeton est invalide, expiré, ou s'il s'agit d'une tentative de réutilisation frauduleuse.
   */
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

    // Début de la transaction PostgreSQL isolée
    const outcome = await this.drizzle.db.transaction<RotationOutcome>(async (transaction) => {
      const [tokenOwner] = await transaction
        .select({ userId: refreshTokens.userId })
        .from(refreshTokens)
        .where(eq(refreshTokens.tokenHash, tokenHash))
        .limit(1);

      if (!tokenOwner) return { status: 'invalid' };

      // Verrouiller la session de l'utilisateur avec pg_advisory_xact_lock pour sérialiser les appels concurrents
      await acquireUserSessionLock(transaction, tokenOwner.userId);

      const [storedToken] = await transaction
        .select()
        .from(refreshTokens)
        .where(eq(refreshTokens.tokenHash, tokenHash))
        .limit(1);

      if (!storedToken || storedToken.userId !== tokenOwner.userId) return { status: 'invalid' };

      // 1. Détection de vol : Si le jeton a déjà été révoqué, révoquer TOUTE la famille de jetons
      if (storedToken.revokedAt) {
        await this.revokeFamilySessions(transaction, storedToken.familyId);
        return { status: 'invalid' };
      }

      // 2. Contrôle de l'empreinte IP et User-Agent
      if (storedToken.ipAddress !== ipAddress || storedToken.userAgent !== userAgent) {
        await this.revokeFamilySessions(transaction, storedToken.familyId);
        return { status: 'invalid' };
      }

      // 3. Contrôle de l'expiration temporelle
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

      // Consommer le jeton actuel en lui attribuant un horodatage de réitération
      const [consumed] = await transaction
        .update(refreshTokens)
        .set({ revokedAt: new Date() })
        .where(and(eq(refreshTokens.id, storedToken.id), isNull(refreshTokens.revokedAt)))
        .returning({ id: refreshTokens.id });

      if (!consumed) {
        await this.revokeFamilySessions(transaction, storedToken.familyId);
        return { status: 'invalid' };
      }

      // Émettre le nouveau jeton au sein de la même famille (familyId)
      const next = this.newSession(user.id, ipAddress, userAgent, storedToken.familyId);
      await transaction.insert(refreshTokens).values(next.record);
      const session = finalize
        ? { refreshToken: next.rawToken, user, finalized: await finalize(user) }
        : { refreshToken: next.rawToken, user };
      return { status: 'rotated', session };
    });

    if (outcome.status === 'invalid') {
      throw new UnauthorizedException('Refresh token invalide, expiré ou réutilisé.');
    }
    return outcome.session;
  }

  /**
   * Instancie la structure mémoire d'une nouvelle session de rafraîchissement.
   */
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

  /**
   * Révoque l'ensemble des jetons appartenant à une même famille de session (`familyId`).
   */
  private async revokeFamilySessions(transaction: DatabaseTransaction, familyId: string): Promise<void> {
    await transaction
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(refreshTokens.familyId, familyId), isNull(refreshTokens.revokedAt)));
  }

  /**
   * Calcule le dôme SHA-256 du jeton brut pour comparaison sécurisée en base.
   */
  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
