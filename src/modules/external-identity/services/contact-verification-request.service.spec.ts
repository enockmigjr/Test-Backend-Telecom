import { Test } from '@nestjs/testing';
import { PublicSupportConfigService } from '../../../config/public-support.config';
import { DrizzleProvider } from '../../../database/drizzle.provider';
import { IntegrationSecretCipherService } from '../../support-integrations/services/integration-secret-cipher.service';
import { CONTACT_VERIFICATION_PROVIDER } from '../providers/contact-verification-provider.interface';
import { ContactVerificationService } from './contact-verification.service';
import { ExternalIdentityStoreService } from './external-identity-store.service';
import { PublicIdentityCryptoService } from './public-identity-crypto.service';
import { PublicRateLimitService } from './public-rate-limit.service';

function query(result: readonly unknown[]) {
  const builder = { from: jest.fn(), where: jest.fn(), orderBy: jest.fn(), limit: jest.fn().mockResolvedValue(result) };
  builder.from.mockReturnValue(builder);
  builder.where.mockReturnValue(builder);
  builder.orderBy.mockReturnValue(builder);
  return builder;
}

describe('ContactVerificationService.requestEmail', () => {
  const select = jest.fn();
  const updateWhere = jest.fn();
  const values = jest.fn();
  const quotas = { consume: jest.fn() };
  let service: ContactVerificationService;

  beforeEach(async () => {
    jest.clearAllMocks();
    select
      .mockReturnValueOnce(
        query([
          {
            id: 'integration-1',
            quotaPolicy: {
              verificationRequestsPerHour: 5,
              verificationRequestsPerIpHour: 20,
              verificationRequestsPerIntegrationHour: 500,
            },
          },
        ]),
      )
      .mockReturnValueOnce(query([]));
    const db = {
      execute: jest.fn(),
      select,
      update: jest.fn(() => ({ set: jest.fn(() => ({ where: updateWhere })) })),
      insert: jest.fn(() => ({ values })),
    };
    const drizzle = {
      db,
      runInTransaction: (callback: () => Promise<unknown>) => callback(),
      afterCommit: jest.fn(),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        ContactVerificationService,
        { provide: DrizzleProvider, useValue: drizzle },
        {
          provide: PublicSupportConfigService,
          useValue: { otpResendSeconds: 60, otpTtlSeconds: 600, otpMaxAttempts: 5 },
        },
        {
          provide: PublicIdentityCryptoService,
          useValue: { contactHash: jest.fn(() => 'contact-hash'), codeHash: jest.fn(() => 'code-hash') },
        },
        {
          provide: IntegrationSecretCipherService,
          useValue: { seal: jest.fn(() => ({ keyVersion: 1, encryptedSecret: 'sealed' })) },
        },
        { provide: PublicRateLimitService, useValue: quotas },
        { provide: ExternalIdentityStoreService, useValue: {} },
        { provide: CONTACT_VERIFICATION_PROVIDER, useValue: { sendEmailCode: jest.fn() } },
      ],
    }).compile();
    service = moduleRef.get(ContactVerificationService);
  });

  it('invalide les anciens codes et applique des seuils distincts avant le nouvel envoi', async () => {
    await service.requestEmail('public-integration-key', 'Client@Example.com', '127.0.0.1');

    expect(updateWhere).toHaveBeenCalledTimes(1);
    expect(values).toHaveBeenCalledWith(expect.objectContaining({ contactHash: 'contact-hash' }));
    expect(quotas.consume).toHaveBeenCalledWith(
      'verification-request',
      expect.arrayContaining([
        expect.objectContaining({ value: 'integration:integration-1', limit: 500 }),
        expect.objectContaining({ value: 'contact:contact-hash', limit: 5 }),
      ]),
      3600,
    );
  });
});
