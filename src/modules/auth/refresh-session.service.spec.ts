/**
 * ============================================================================
 * FICHIER : src/modules/auth/refresh-session.service.spec.ts
 * RÔLE : Suite de tests unitaires pour le composant refresh-session.service.
 * EXPLICATION :
 * Ce fichier contient les tests automatisés validant le comportement et l'intégrité de refresh-session.service.
 * 1. Vérifie le fonctionnement nominal et les cas d'erreur.
 * 2. Garantit qu'aucune régression n'est introduite lors des évolutions du code.
 * ============================================================================
 */

import { UnauthorizedException } from '@nestjs/common';
import { mock } from 'jest-mock-extended';

import { DrizzleProvider } from '../../database/drizzle.provider';
import { JwtConfigService } from '../../config/jwt.config';
import { RefreshSessionService } from './refresh-session.service';

const user = {
  id: 'user-001',
  departmentId: 'dept-001',
  email: 'agent@telecom.local',
  passwordHash: 'hash',
  firstName: 'Jean',
  lastName: 'Dupont',
  role: 'CUSTOMER_SERVICE_AGENT' as const,
  isActive: true,
  isAvailable: true,
  maxConcurrentTickets: 5,
  absenceEndsAt: null,
  lastAssignedAt: null,
  mustChangePassword: false,
  lastLoginAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
};

const storedToken = {
  id: 'token-001',
  familyId: 'family-001',
  userId: user.id,
  tokenHash: 'hash',
  userAgent: 'Browser/1',
  ipAddress: '10.0.0.1',
  expiresAt: new Date(Date.now() + 60_000),
  revokedAt: null,
  createdAt: new Date(),
};

interface TransactionDouble {
  readonly select: jest.Mock;
  readonly update: jest.Mock;
  readonly insert: jest.Mock;
  readonly execute: jest.Mock;
}

function createHarness(selectResults: readonly unknown[][], consumed = true) {
  const limit = jest.fn();
  selectResults.forEach((result) => limit.mockResolvedValueOnce(result));
  const selectBuilder = {
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    limit,
  };
  const returning = jest.fn().mockResolvedValue(consumed ? [{ id: storedToken.id }] : []);
  const updateBuilder = {
    set: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnValue({ returning }),
  };
  const insertBuilder = { values: jest.fn().mockResolvedValue(undefined) };
  const transaction: TransactionDouble = {
    select: jest.fn().mockReturnValue(selectBuilder),
    update: jest.fn().mockReturnValue(updateBuilder),
    insert: jest.fn().mockReturnValue(insertBuilder),
    execute: jest.fn().mockResolvedValue([]),
  };
  const database = {
    transaction: jest.fn(async (callback: (value: TransactionDouble) => Promise<unknown>) => callback(transaction)),
    insert: jest.fn().mockReturnValue(insertBuilder),
  };
  const jwtConfig = mock<JwtConfigService>();
  Object.defineProperty(jwtConfig, 'refreshExpirationSeconds', { get: () => 604800 });
  const drizzle = { db: database } as unknown as DrizzleProvider;

  return {
    service: new RefreshSessionService(drizzle, jwtConfig),
    transaction,
    returning,
    insertBuilder,
  };
}

describe('RefreshSessionService', () => {
  /** Test : consomme le token puis cree un refresh token distinct dans la meme transaction */
  it('consomme le token puis cree un refresh token distinct dans la meme transaction', async () => {
    const harness = createHarness([[{ userId: user.id }], [storedToken], [user]]);

    const result = await harness.service.rotate('old-token', '10.0.0.1', 'Browser/1');

    expect(result.refreshToken).not.toBe('old-token');
    expect(result.refreshToken).toHaveLength(96);
    expect(harness.returning).toHaveBeenCalledTimes(1);
    expect(harness.transaction.execute).toHaveBeenCalledTimes(1);
    expect(harness.insertBuilder.values).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: user.id,
        familyId: storedToken.familyId,
        ipAddress: '10.0.0.1',
        userAgent: 'Browser/1',
      }),
    );
  });

  it("finalise l'access token avant de libérer le verrou de rotation", async () => {
    const harness = createHarness([[{ userId: user.id }], [storedToken], [user]]);
    const finalize = jest.fn().mockResolvedValue({ accessToken: 'access-inside-lock' });

    const result = await harness.service.rotate('old-token', '10.0.0.1', 'Browser/1', finalize);

    expect(finalize).toHaveBeenCalledWith(user);
    expect(result.finalized).toEqual({ accessToken: 'access-inside-lock' });
    expect(harness.transaction.execute).toHaveBeenCalledTimes(1);
  });

  /** Test : rejette et revoque les sessions si le contexte IP ou User-Agent change */

  it('rejette et revoque les sessions si le contexte IP ou User-Agent change', async () => {
    const harness = createHarness([[{ userId: user.id }], [storedToken]]);

    await expect(harness.service.rotate('old-token', '10.0.0.2', 'Browser/1')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(harness.transaction.update).toHaveBeenCalledTimes(1);
    expect(harness.insertBuilder.values).not.toHaveBeenCalled();
  });

  /** Test : traite comme replay un token deja revoque et revoque les sessions actives */

  it('traite comme replay un token deja revoque et revoque les sessions actives', async () => {
    const harness = createHarness([[{ userId: user.id }], [{ ...storedToken, revokedAt: new Date() }]]);

    await expect(harness.service.rotate('old-token', '10.0.0.1', 'Browser/1')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(harness.transaction.update).toHaveBeenCalledTimes(1);
  });

  /** Test : rejette le perdant de deux consommations concurrentes et revoque les sessions */

  it('rejette le perdant de deux consommations concurrentes et revoque les sessions', async () => {
    const harness = createHarness([[{ userId: user.id }], [storedToken], [user]], false);

    await expect(harness.service.rotate('old-token', '10.0.0.1', 'Browser/1')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(harness.returning).toHaveBeenCalledTimes(1);
    expect(harness.transaction.update).toHaveBeenCalledTimes(2);
    expect(harness.insertBuilder.values).not.toHaveBeenCalled();
  });
});
