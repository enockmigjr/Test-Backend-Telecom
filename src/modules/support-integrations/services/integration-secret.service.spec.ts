import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DrizzleProvider } from '../../../database/drizzle.provider';
import { AuditLogsService } from '../../audit-logs/audit-logs.service';
import { PublicSupportConfigService } from '../../../config/public-support.config';
import { IntegrationSecretCipherService } from './integration-secret-cipher.service';
import { IntegrationSecretService } from './integration-secret.service';
import { SupportIntegrationsService } from './support-integrations.service';

describe('IntegrationSecretService', () => {
  const execute = jest.fn();
  const returning = jest.fn();
  const values = jest.fn(() => ({ returning }));
  const query = {
    from: jest.fn(),
    where: jest.fn(),
    orderBy: jest.fn(),
    limit: jest.fn().mockResolvedValue([]),
  };
  query.from.mockReturnValue(query);
  query.where.mockReturnValue(query);
  query.orderBy.mockReturnValue(query);
  const db = {
    execute,
    select: jest.fn(() => query),
    update: jest.fn(() => ({ set: jest.fn(() => ({ where: jest.fn() })) })),
    insert: jest.fn(() => ({ values })),
  };
  const integrations = { requireIntegration: jest.fn() };
  let service: IntegrationSecretService;

  beforeEach(async () => {
    jest.clearAllMocks();
    execute.mockResolvedValue(undefined);
    query.limit.mockResolvedValue([]);
    returning.mockResolvedValue([{ id: 'credential-1', version: 1 }]);
    const moduleRef = await Test.createTestingModule({
      providers: [
        IntegrationSecretService,
        { provide: DrizzleProvider, useValue: { db, runInTransaction: (callback: () => unknown) => callback() } },
        { provide: SupportIntegrationsService, useValue: integrations },
        {
          provide: IntegrationSecretCipherService,
          useValue: { seal: jest.fn(() => ({ encryptedSecret: 'sealed', keyVersion: 1 })) },
        },
        { provide: PublicSupportConfigService, useValue: { secretRotationGraceMinutes: 15 } },
        { provide: AuditLogsService, useValue: { create: jest.fn() } },
      ],
    }).compile();
    service = moduleRef.get(IntegrationSecretService);
  });

  it('refuse un secret de 32 caractères prévisible', async () => {
    await expect(service.rotate('integration-1', 'a'.repeat(32), 'admin-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(integrations.requireIntegration).not.toHaveBeenCalled();
  });

  it('sérialise la rotation avant de calculer la prochaine version', async () => {
    const secret = Buffer.alloc(32, 7).toString('base64url');
    await service.rotate('integration-1', secret, 'admin-1');

    expect(execute).toHaveBeenCalledTimes(1);
    expect(db.select).toHaveBeenCalledTimes(1);
    expect(values).toHaveBeenCalledWith(expect.objectContaining({ version: 1, encryptedSecret: 'sealed' }));
  });
});
