import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { JwtConfigService } from '../../../config/jwt.config';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { DrizzleProvider } from '../../../database/drizzle.provider';
import { RedisProvider } from '../../../common/providers/redis.provider';
import { users } from '../../../database/schemas';
import { eq, and, isNull } from 'drizzle-orm';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly jwtConfig: JwtConfigService,
    private readonly drizzle: DrizzleProvider,
    private readonly redisProvider: RedisProvider,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (req: Request) => {
          if (req && req.query && req.query['token']) {
            return req.query['token'] as string;
          }
          return null;
        },
      ]),
      ignoreExpiration: false,
      secretOrKey: jwtConfig.accessSecret,
    });
  }

  async validate(payload: JwtPayload) {
    // Vérifier si le token est blacklisté dans Redis.
    // Nouvelle stratégie : clé individuelle jwt_bl:{jti} avec TTL automatique.
    // Ancienne stratégie (Set global jwt_blacklist) maintenue pour compatibilité.
    const redis = this.redisProvider.getClient();
    const [isRevokedNew, isRevokedLegacy] = await Promise.all([
      redis.exists(`jwt_bl:${payload.jti}`),
      redis.sismember('jwt_blacklist', payload.jti),
    ]);
    if (isRevokedNew || isRevokedLegacy) {
      throw new UnauthorizedException('Token révoqué.');
    }

    // Vérifier que l'utilisateur existe et est actif
    const [user] = await this.drizzle.db
      .select({
        id: users.id,
        email: users.email,
        role: users.role,
        departmentId: users.departmentId,
        isActive: users.isActive,
      })
      .from(users)
      .where(and(eq(users.id, payload.sub), isNull(users.deletedAt)))
      .limit(1);

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Utilisateur non trouvé ou désactivé.');
    }

    return {
      sub: user.id,
      id: user.id,
      email: user.email,
      role: user.role,
      departmentId: user.departmentId,
      jti: payload.jti,
    };
  }
}
