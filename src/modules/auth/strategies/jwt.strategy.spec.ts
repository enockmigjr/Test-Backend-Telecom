import { UnauthorizedException } from '@nestjs/common';

import { RedisProvider } from '../../../common/providers/redis.provider';
import { JwtConfigService } from '../../../config/jwt.config';
import { DrizzleProvider } from '../../../database/drizzle.provider';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { JwtStrategy } from './jwt.strategy';

const activeUser = {
  id: 'user-001',
  email: 'agent@telecom.local',
  role: 'CUSTOMER_SERVICE_AGENT',
  departmentId: 'dept-001',
  isActive: true,
  mustChangePassword: false,
};

function createStrategy(userRevokedAfter: string | null) {
  const limit = jest.fn().mockResolvedValue([activeUser]);
  const drizzle = {
    db: { select: jest.fn(() => ({ from: jest.fn(() => ({ where: jest.fn(() => ({ limit })) })) })) },
  } as unknown as DrizzleProvider;
  const redis = {
    exists: jest.fn().mockResolvedValue(0),
    sismember: jest.fn().mockResolvedValue(0),
    get: jest.fn().mockResolvedValue(userRevokedAfter),
  };
  const redisProvider = { getClient: jest.fn(() => redis) } as unknown as RedisProvider;
  const jwtConfig = { accessSecret: 'test-access-secret-minimum-32-characters' } as JwtConfigService;
  return new JwtStrategy(jwtConfig, drizzle, redisProvider);
}

function payload(sessionIssuedAt: number): JwtPayload {
  return {
    sub: activeUser.id,
    email: activeUser.email,
    role: activeUser.role,
    departmentId: activeUser.departmentId,
    mustChangePassword: false,
    jti: 'jti-001',
    sessionIssuedAt,
  };
}

describe('JwtStrategy — révocation globale', () => {
  it('refuse un access token émis avant logout-all', async () => {
    const strategy = createStrategy('2000');

    await expect(strategy.validate(payload(1999))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('accepte une nouvelle session émise après logout-all', async () => {
    const strategy = createStrategy('2000');

    await expect(strategy.validate(payload(2001))).resolves.toEqual(
      expect.objectContaining({ sub: activeUser.id, sessionIssuedAt: 2001 }),
    );
  });
});
