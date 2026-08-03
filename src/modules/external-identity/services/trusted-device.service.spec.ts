import { UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PublicSupportConfigService } from '../../../config/public-support.config';
import { DrizzleProvider } from '../../../database/drizzle.provider';
import { PublicIdentityCryptoService } from './public-identity-crypto.service';
import { TrustedDeviceService } from './trusted-device.service';

function selectQuery(result: readonly unknown[]) {
  const builder = {
    from: jest.fn(),
    innerJoin: jest.fn(),
    where: jest.fn(),
    limit: jest.fn().mockResolvedValue(result),
  };
  builder.from.mockReturnValue(builder);
  builder.innerJoin.mockReturnValue(builder);
  builder.where.mockReturnValue(builder);
  return builder;
}

describe('TrustedDeviceService', () => {
  const select = jest.fn();
  const values = jest.fn();
  const whereSpy = jest.fn();
  const returning = jest.fn();
  const where = jest.fn((...args: unknown[]) => {
    whereSpy(...args);
    return { returning };
  });
  const db = {
    select,
    insert: jest.fn(() => ({ values })),
    update: jest.fn(() => ({ set: jest.fn(() => ({ where })) })),
  };
  const crypto = { randomOpaqueToken: jest.fn(() => 'opaque-token'), tokenHash: jest.fn(() => 'token-hash') };
  const config = { trustedDeviceDays: 90, trustedDevicePolicyVersion: 3 };
  let service: TrustedDeviceService;

  beforeEach(async () => {
    jest.clearAllMocks();
    values.mockResolvedValue(undefined);
    returning.mockResolvedValue([{ id: 'device-1' }]);
    const moduleRef = await Test.createTestingModule({
      providers: [
        TrustedDeviceService,
        { provide: DrizzleProvider, useValue: { db, runInTransaction: (callback: () => unknown) => callback() } },
        { provide: PublicIdentityCryptoService, useValue: crypto },
        { provide: PublicSupportConfigService, useValue: config },
      ],
    }).compile();
    service = moduleRef.get(TrustedDeviceService);
  });

  it('émet un jeton opaque haché avec la politique de l’intégration', async () => {
    select.mockReturnValue(selectQuery([{ trustPolicy: { trustedDeviceDays: 30, policyVersion: 7 } }]));

    const issued = await service.issue('requester-1', 'integration-1');

    expect(issued.token).toBe('opaque-token');
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({ tokenHash: 'token-hash', policyVersion: 7, externalRequesterId: 'requester-1' }),
    );
    expect(issued.expiresAt.getTime()).toBeGreaterThan(Date.now() + 29 * 86_400_000);
  });

  it('authentifie un appareil actif et met à jour sa dernière utilisation', async () => {
    select.mockReturnValue(
      selectQuery([
        {
          id: 'device-1',
          externalRequesterId: 'requester-1',
          supportIntegrationId: 'integration-1',
          policyVersion: 7,
          trustPolicy: { policyVersion: 7 },
        },
      ]),
    );

    await expect(service.authenticate('site-photo', 'opaque-token')).resolves.toEqual(
      expect.objectContaining({ id: 'device-1' }),
    );
    expect(whereSpy).toHaveBeenCalledTimes(1);
  });

  it('refuse une version de politique révoquée', async () => {
    select.mockReturnValue(selectQuery([{ id: 'device-1', policyVersion: 6, trustPolicy: { policyVersion: 7 } }]));

    await expect(service.authenticate('site-photo', 'opaque-token')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(db.update).not.toHaveBeenCalled();
  });

  it('fait tourner le jeton sans prolonger la confiance hors de la fenêtre de renouvellement', async () => {
    const originalExpiry = new Date(Date.now() + 60 * 86_400_000);
    select.mockReturnValue(
      selectQuery([
        {
          id: 'device-1',
          expiresAt: originalExpiry,
          policyVersion: 7,
          trustPolicy: { trustedDeviceDays: 90, policyVersion: 7, renewalWindowDays: 7 },
        },
      ]),
    );

    const rotated = await service.rotate('device-1', 'requester-1', 'integration-1');

    expect(rotated.expiresAt).toEqual(originalExpiry);
    expect(values).toHaveBeenCalledWith(expect.objectContaining({ expiresAt: originalExpiry, policyVersion: 7 }));
  });

  it('révoque explicitement un appareil du demandeur', async () => {
    await service.revoke('device-1', 'requester-1');

    expect(db.update).toHaveBeenCalledTimes(1);
    expect(whereSpy).toHaveBeenCalledTimes(1);
  });
});
