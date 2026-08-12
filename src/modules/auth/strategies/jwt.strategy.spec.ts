/**
 * ============================================================================
 * FICHIER : src/modules/auth/strategies/jwt.strategy.spec.ts
 * RÔLE : Suite de tests unitaires pour le composant jwt.strategy.
 * EXPLICATION :
 * Ce fichier contient les tests automatisés validant le comportement et l'intégrité de jwt.strategy.
 * 1. Vérifie le fonctionnement nominal et les cas d'erreur.
 * 2. Garantit qu'aucune régression n'est introduite lors des évolutions du code.
 * ============================================================================
 */

import { UnauthorizedException } from '@nestjs/common';

import { RedisProvider } from '../../../common/providers/redis.provider';
import { JwtConfigService } from '../../../config/jwt.config';
import { DrizzleProvider } from '../../../database/drizzle.provider';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { KeycloakJwksService } from '../services/keycloak-jwks.service';
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
  const keycloakJwks = {
    publicKey: jest.fn().mockResolvedValue('-----BEGIN CERTIFICATE-----test-----END CERTIFICATE-----'),
  } as unknown as KeycloakJwksService;
  return new JwtStrategy(jwtConfig, drizzle, redisProvider, keycloakJwks);
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
  /** Test : refuse un access token émis avant logout-all */
  it('refuse un access token émis avant logout-all', async () => {
    const strategy = createStrategy('2000');

    await expect(strategy.validate(payload(1999))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  /** Test : accepte une nouvelle session émise après logout-all */

  it('accepte une nouvelle session émise après logout-all', async () => {
    const strategy = createStrategy('2000');

    await expect(strategy.validate(payload(2001))).resolves.toEqual(
      expect.objectContaining({ sub: activeUser.id, sessionIssuedAt: 2001 }),
    );
  });
});

describe('JwtStrategy — jeton Keycloak', () => {
  it('résout le profil métier via keycloakSubjectId et le rôle du realm', async () => {
    const previousIssuer = process.env['KEYCLOAK_ISSUER'];
    process.env['KEYCLOAK_ISSUER'] = 'http://keycloak.test/realms/telecom';
    const strategy = createStrategy(null);
    try {
      const result = await strategy.validate({
        sub: 'keycloak-subject-123',
        email: 'agent@telecom.local',
        jti: 'k-jti',
        realm_access: { roles: ['NOC_ENGINEER', 'CUSTOMER_SERVICE_AGENT'] },
        iss: 'http://keycloak.test/realms/telecom',
      } as unknown as JwtPayload);
      expect(result).toMatchObject({ id: 'user-001', role: 'NOC_ENGINEER' });
    } finally {
      if (previousIssuer === undefined) delete process.env['KEYCLOAK_ISSUER'];
      else process.env['KEYCLOAK_ISSUER'] = previousIssuer;
    }
  });
});
