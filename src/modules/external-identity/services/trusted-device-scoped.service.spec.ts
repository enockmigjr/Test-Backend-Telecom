import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { PublicSupportConfigService } from '../../../config/public-support.config';
import { DrizzleProvider } from '../../../database/drizzle.provider';
import { PublicIdentityCryptoService } from './public-identity-crypto.service';
import { TrustedDeviceService } from './trusted-device.service';

function scopedParameters(condition: SQL | undefined): readonly unknown[] {
  expect(condition).toBeDefined();
  if (!condition) throw new Error('Clause de cloisonnement absente.');
  return new PgDialect().sqlToQuery(condition).params;
}

describe('TrustedDeviceService list/revokeScoped', () => {
  const selectWhere = jest.fn((condition: SQL) => {
    selectCondition = condition;
    return selectBuilder;
  });
  const selectBuilder = {
    from: jest.fn(),
    where: selectWhere,
    orderBy: jest.fn(),
    limit: jest.fn(),
  };
  const select = jest.fn(() => selectBuilder);
  const returning = jest.fn();
  const updateWhere = jest.fn((condition: SQL) => {
    updateCondition = condition;
    return { returning };
  });
  const set = jest.fn(() => ({ where: updateWhere }));
  const update = jest.fn(() => ({ set }));
  const db = { select, update };
  let selectCondition: SQL | undefined;
  let updateCondition: SQL | undefined;
  let service: TrustedDeviceService;

  beforeAll(() => {
    selectBuilder.from.mockReturnValue(selectBuilder);
    selectBuilder.orderBy.mockReturnValue(selectBuilder);
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    selectCondition = undefined;
    updateCondition = undefined;
    const moduleRef = await Test.createTestingModule({
      providers: [
        TrustedDeviceService,
        { provide: DrizzleProvider, useValue: { db } },
        { provide: PublicIdentityCryptoService, useValue: {} },
        { provide: PublicSupportConfigService, useValue: {} },
      ],
    }).compile();
    service = moduleRef.get(TrustedDeviceService);
  });

  it('liste uniquement le demandeur et l integration courants et identifie l appareil actif', async () => {
    const createdAt = new Date('2026-08-01T10:00:00.000Z');
    selectBuilder.orderBy.mockResolvedValueOnce([
      { id: 'device-current', createdAt, lastUsedAt: createdAt, expiresAt: createdAt, revokedAt: null },
    ]);
    selectBuilder.orderBy.mockReturnValueOnce(selectBuilder);
    selectBuilder.limit.mockResolvedValue([
      { id: 'device-old', createdAt, lastUsedAt: null, expiresAt: createdAt, revokedAt: createdAt },
    ]);

    const result = await service.list('requester-1', 'integration-1', 'device-current');

    expect(result.data.map(({ id, current }) => ({ id, current }))).toEqual([
      { id: 'device-current', current: true },
      { id: 'device-old', current: false },
    ]);
    expect(scopedParameters(selectCondition)).toEqual(expect.arrayContaining(['requester-1', 'integration-1']));
    expect(selectBuilder.limit).toHaveBeenCalledWith(20);
  });

  it('revoque seulement l appareil appartenant au demandeur et a l integration', async () => {
    returning.mockResolvedValue([{ id: 'device-1' }]);

    await expect(service.revokeScoped('device-1', 'requester-1', 'integration-1')).resolves.toBeUndefined();

    expect(scopedParameters(updateCondition)).toEqual(
      expect.arrayContaining(['device-1', 'requester-1', 'integration-1']),
    );
  });

  it('retourne 404 si l appareil est absent, deja revoque ou hors perimetre', async () => {
    returning.mockResolvedValue([]);

    await expect(service.revokeScoped('device-other', 'requester-1', 'integration-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
