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
import { DrizzleProvider } from '../../../database/drizzle.provider';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { KeycloakTokenVerifierService } from '../services/keycloak-token-verifier.service';
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
  const tokenVerifier = {
    publicKeyForToken: jest.fn().mockResolvedValue('-----BEGIN CERTIFICATE-----test-----END CERTIFICATE-----'),
  } as unknown as KeycloakTokenVerifierService;
  return new JwtStrategy(drizzle, redisProvider, tokenVerifier);
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
      expect.objectContaining({ sub: activeUser.id, role: 'CUSTOMER_SERVICE_AGENT' }),
    );
  });
});

describe('JwtStrategy — jeton Keycloak', () => {
  it('refuse un jeton Keycloak révoqué via jwt_user_bl (logout-all)', async () => {
    const previousIssuer = process.env['KEYCLOAK_ISSUER'];
    process.env['KEYCLOAK_ISSUER'] = 'http://keycloak.test/realms/telecom';
    const strategy = createStrategy(String(Date.now()));
    try {
      await expect(
        strategy.validate({
          sub: 'keycloak-subject-revoked',
          email: 'agent@telecom.local',
          jti: 'k-jti-revoked',
          iss: 'http://keycloak.test/realms/telecom',
        } as unknown as JwtPayload),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    } finally {
      if (previousIssuer === undefined) delete process.env['KEYCLOAK_ISSUER'];
      else process.env['KEYCLOAK_ISSUER'] = previousIssuer;
    }
  });

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

  it('lie le profil métier au premier login via l email vérifié', async () => {
    const previousIssuer = process.env['KEYCLOAK_ISSUER'];
    process.env['KEYCLOAK_ISSUER'] = 'http://keycloak.test/realms/telecom';
    const limit = jest.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([activeUser]);
    const updateMock = jest.fn(() => ({ set: jest.fn(() => ({ where: jest.fn(() => Promise.resolve(undefined)) })) }));
    const drizzle = {
      db: {
        select: jest.fn(() => ({ from: jest.fn(() => ({ where: jest.fn(() => ({ limit })) })) })),
        update: updateMock,
      },
    } as unknown as DrizzleProvider;
    const redis = {
      getClient: jest.fn(() => ({ exists: jest.fn().mockResolvedValue(0) })),
    } as unknown as RedisProvider;
    const tokenVerifier = { publicKeyForToken: jest.fn() } as unknown as KeycloakTokenVerifierService;
    const strategy = new JwtStrategy(drizzle, redis, tokenVerifier);
    try {
      const result = await strategy.validate({
        sub: 'keycloak-subject-new',
        email: 'agent@telecom.local',
        email_verified: true,
        jti: 'k-jti-2',
        realm_access: { roles: ['FIELD_TECHNICIAN'] },
        iss: 'http://keycloak.test/realms/telecom',
      } as unknown as JwtPayload);
      expect(result).toMatchObject({ id: 'user-001', role: 'FIELD_TECHNICIAN' });
      expect(updateMock).toHaveBeenCalled();
    } finally {
      if (previousIssuer === undefined) delete process.env['KEYCLOAK_ISSUER'];
      else process.env['KEYCLOAK_ISSUER'] = previousIssuer;
    }
  });

  it('ignore les rôles techniques (default-roles, offline_access) et garde le rôle métier', async () => {
    const previousIssuer = process.env['KEYCLOAK_ISSUER'];
    process.env['KEYCLOAK_ISSUER'] = 'http://keycloak.test/realms/telecom';
    const strategy = createStrategy(null);
    try {
      const result = await strategy.validate({
        sub: 'keycloak-subject-supervisor',
        email: 'supervisor@telecom.local',
        jti: 'k-jti-3',
        realm_access: {
          roles: ['default-roles-telecom', 'SUPERVISOR', 'offline_access', 'uma_authorization'],
        },
        iss: 'http://keycloak.test/realms/telecom',
      } as unknown as JwtPayload);
      expect(result).toMatchObject({ id: 'user-001', role: 'SUPERVISOR' });
    } finally {
      if (previousIssuer === undefined) delete process.env['KEYCLOAK_ISSUER'];
      else process.env['KEYCLOAK_ISSUER'] = previousIssuer;
    }
  });
});
