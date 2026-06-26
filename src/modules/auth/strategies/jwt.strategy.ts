import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtConfigService } from '../../../config/jwt.config';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { DrizzleProvider } from '../../../database/drizzle.provider';
import { users } from '../../../database/schemas';
import { eq, and, isNull } from 'drizzle-orm';
import { Redis } from 'ioredis';
import { redisConfig } from '../../../common/providers/redis.config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  private redis: Redis;

  constructor(
    private readonly jwtConfig: JwtConfigService,
    private readonly drizzle: DrizzleProvider,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtConfig.accessSecret,
    });
  }

  private async getRedis(): Promise<Redis> {
    if (!this.redis) {
      this.redis = new Redis({
        host: redisConfig.host,
        port: redisConfig.port,
        password: redisConfig.password || undefined,
        maxRetriesPerRequest: 3,
      });
    }
    return this.redis;
  }

  async validate(payload: JwtPayload) {
    // Vérifier si le token est dans la blacklist Redis
    const redis = await this.getRedis();
    const isRevoked = await redis.sismember('jwt_blacklist', payload.jti);
    if (isRevoked) {
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
      id: user.id,
      email: user.email,
      role: user.role,
      departmentId: user.departmentId,
      jti: payload.jti,
    };
  }
}
