import { Test } from '@nestjs/testing';
import { PublicSupportConfigService } from '../../../config/public-support.config';
import { DrizzleProvider } from '../../../database/drizzle.provider';
import { IntegrationSecretCipherService } from '../../support-integrations/services/integration-secret-cipher.service';
import { CONTACT_VERIFICATION_PROVIDER } from '../providers/contact-verification-provider.interface';
import { ContactVerificationService } from './contact-verification.service';
import { ExternalIdentityStoreService } from './external-identity-store.service';
import { PublicIdentityCryptoService } from './public-identity-crypto.service';
import { PublicRateLimitService } from './public-rate-limit.service';

describe('ContactVerificationService.consumeEmail', () => {
  const quotaPolicyQuery = {
    from: jest.fn(),
    where: jest.fn(),
    limit: jest.fn().mockResolvedValue([{ quotaPolicy: { verificationAttemptsPerHour: 10 } }]),
  };
  quotaPolicyQuery.from.mockReturnValue(quotaPolicyQuery);
  quotaPolicyQuery.where.mockReturnValue(quotaPolicyQuery);
  const quotas = { consume: jest.fn() };
  const crypto = { codeHash: jest.fn(), matches: jest.fn() };
  const identityStore = {
    findChallenge: jest.fn(),
    expireChallenge: jest.fn(),
    recordFailure: jest.fn(),
    consume: jest.fn(),
  };
  let service: ContactVerificationService;

  beforeEach(async () => {
    jest.clearAllMocks();
    quotas.consume.mockResolvedValue(undefined);
    crypto.codeHash.mockReturnValue('candidate-hash');
    const moduleRef = await Test.createTestingModule({
      providers: [
        ContactVerificationService,
        { provide: DrizzleProvider, useValue: { db: { select: jest.fn(() => quotaPolicyQuery) } } },
        { provide: PublicSupportConfigService, useValue: {} },
        { provide: PublicIdentityCryptoService, useValue: crypto },
        { provide: IntegrationSecretCipherService, useValue: {} },
        { provide: PublicRateLimitService, useValue: quotas },
        { provide: ExternalIdentityStoreService, useValue: identityStore },
        { provide: CONTACT_VERIFICATION_PROVIDER, useValue: { sendEmailCode: jest.fn() } },
      ],
    }).compile();
    service = moduleRef.get(ContactVerificationService);
  });

  it('expire un challenge dépassé sans révéler sa cause', async () => {
    identityStore.findChallenge.mockResolvedValue(challenge({ expiresAt: new Date(Date.now() - 1) }));

    await expect(service.consumeEmail('challenge-1', '123456', '127.0.0.1')).resolves.toEqual({ verified: false });
    expect(identityStore.expireChallenge).toHaveBeenCalledWith('challenge-1');
    expect(identityStore.consume).not.toHaveBeenCalled();
  });

  it('retourne la même erreur uniforme pour un challenge absent ou déjà consommé', async () => {
    identityStore.findChallenge
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(challenge({ status: 'VERIFIED' }));

    const absent = await service.consumeEmail('unknown', '123456', '127.0.0.1');
    const replay = await service.consumeEmail('challenge-1', '123456', '127.0.0.1');

    expect(absent).toEqual({ verified: false });
    expect(replay).toEqual(absent);
    expect(identityStore.consume).not.toHaveBeenCalled();
  });

  it('compte un code incorrect et conserve une réponse uniforme', async () => {
    identityStore.findChallenge.mockResolvedValue(challenge());
    crypto.matches.mockReturnValue(false);

    await expect(service.consumeEmail('challenge-1', '000000', '127.0.0.1')).resolves.toEqual({ verified: false });
    expect(identityStore.recordFailure).toHaveBeenCalledWith('challenge-1');
  });

  it('délègue la consommation atomique pour un code valide', async () => {
    const outcome = { verified: true, requesterId: 'requester-1', integrationId: 'integration-1' } as const;
    identityStore.findChallenge.mockResolvedValue(challenge());
    identityStore.consume.mockResolvedValue(outcome);
    crypto.matches.mockReturnValue(true);

    await expect(service.consumeEmail('challenge-1', '123456', '127.0.0.1')).resolves.toEqual(outcome);
    expect(identityStore.consume).toHaveBeenCalledWith(expect.objectContaining({ id: 'challenge-1' }));
  });
});

function challenge(overrides: Record<string, unknown> = {}) {
  return {
    id: 'challenge-1',
    status: 'PENDING',
    codeHash: 'expected-hash',
    expiresAt: new Date(Date.now() + 60_000),
    supportIntegrationId: 'integration-1',
    contactHash: 'contact-hash',
    ...overrides,
  };
}
