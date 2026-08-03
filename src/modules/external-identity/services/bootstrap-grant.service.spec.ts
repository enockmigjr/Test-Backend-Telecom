import { UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PublicSupportConfigService } from '../../../config/public-support.config';
import { DrizzleProvider } from '../../../database/drizzle.provider';
import { BootstrapGrantService } from './bootstrap-grant.service';
import { PublicIdentityCryptoService } from './public-identity-crypto.service';

describe('BootstrapGrantService', () => {
  const values = jest.fn();
  const returning = jest.fn();
  const db = {
    insert: jest.fn(() => ({ values })),
    update: jest.fn(() => ({ set: jest.fn(() => ({ where: jest.fn(() => ({ returning })) })) })),
  };
  const crypto = {
    randomOpaqueToken: jest.fn(() => 'bootstrap-code'),
    opaqueHash: jest.fn(() => 'bootstrap-hash'),
  };
  let service: BootstrapGrantService;

  beforeEach(async () => {
    jest.clearAllMocks();
    values.mockResolvedValue(undefined);
    const moduleRef = await Test.createTestingModule({
      providers: [
        BootstrapGrantService,
        { provide: DrizzleProvider, useValue: { db } },
        { provide: PublicSupportConfigService, useValue: { bootstrapTtlSeconds: 120, publicSessionAudience: 'bff' } },
        { provide: PublicIdentityCryptoService, useValue: crypto },
      ],
    }).compile();
    service = moduleRef.get(BootstrapGrantService);
  });

  it('émet un code opaque lié au demandeur, à l’intégration et à l’appareil source', async () => {
    const issued = await service.issue('requester-1', 'integration-1', 'device-1');

    expect(issued.code).toBe('bootstrap-code');
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        codeHash: 'bootstrap-hash',
        audience: 'bff',
        externalRequesterId: 'requester-1',
        trustedDeviceId: 'device-1',
      }),
    );
  });

  it('consomme atomiquement un grant une seule fois', async () => {
    returning.mockResolvedValueOnce([
      { externalRequesterId: 'requester-1', supportIntegrationId: 'integration-1', trustedDeviceId: 'device-1' },
    ]);

    await expect(service.consume('bootstrap-code')).resolves.toEqual({
      externalRequesterId: 'requester-1',
      supportIntegrationId: 'integration-1',
      trustedDeviceId: 'device-1',
    });
  });

  it('refuse un grant expiré, inconnu ou déjà consommé', async () => {
    returning.mockResolvedValueOnce([]);
    await expect(service.consume('bootstrap-code')).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
