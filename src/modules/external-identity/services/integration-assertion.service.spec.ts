import { ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { sign } from 'jsonwebtoken';
import { RedisProvider } from '../../../common/providers/redis.provider';
import { PublicSupportConfigService } from '../../../config/public-support.config';
import { DrizzleProvider } from '../../../database/drizzle.provider';
import { IntegrationSecretService } from '../../support-integrations/services/integration-secret.service';
import { IntegrationAssertionService } from './integration-assertion.service';
import { WordPressIdentityStoreService } from './wordpress-identity-store.service';

const currentSecret = 'current-integration-secret-long-de-32-caracteres';
const graceSecret = 'previous-integration-secret-long-de-32-caracteres';

function integrationQuery(result: readonly unknown[]) {
  const builder = { from: jest.fn(), where: jest.fn(), limit: jest.fn().mockResolvedValue(result) };
  builder.from.mockReturnValue(builder);
  builder.where.mockReturnValue(builder);
  return builder;
}

describe('IntegrationAssertionService', () => {
  const integration = {
    id: 'integration-1',
    publicKey: 'site-photo',
    allowedOrigins: ['https://photos.example.com'],
  };
  const select = jest.fn();
  const activeSecrets = jest.fn();
  const upsert = jest.fn();
  const set = jest.fn();
  let service: IntegrationAssertionService;

  beforeEach(async () => {
    jest.clearAllMocks();
    select.mockReturnValue(integrationQuery([integration]));
    activeSecrets.mockResolvedValue([
      { credentialId: 'current', version: 2, secret: currentSecret },
      { credentialId: 'grace', version: 1, secret: graceSecret },
    ]);
    upsert.mockResolvedValue('requester-1');
    set.mockResolvedValue('OK');
    const moduleRef = await Test.createTestingModule({
      providers: [
        IntegrationAssertionService,
        { provide: DrizzleProvider, useValue: { db: { select } } },
        { provide: IntegrationSecretService, useValue: { activeSecrets } },
        { provide: WordPressIdentityStoreService, useValue: { upsert } },
        { provide: RedisProvider, useValue: { getClient: () => ({ set }) } },
        {
          provide: PublicSupportConfigService,
          useValue: { integrationAssertionAudience: 'telecom-assertion', integrationAssertionMaxAgeSeconds: 120 },
        },
      ],
    }).compile();
    service = moduleRef.get(IntegrationAssertionService);
  });

  it.each([
    ['secret courant', currentSecret],
    ['secret précédent encore en grâce', graceSecret],
  ])('accepte le %s et consomme le nonce', async (_label, secret) => {
    await expect(service.exchange(assertion(secret))).resolves.toEqual(
      expect.objectContaining({ externalRequesterId: 'requester-1', supportIntegrationId: 'integration-1' }),
    );
    expect(set).toHaveBeenCalledWith(
      expect.stringContaining('public:assertion-nonce:integration-1:'),
      '1',
      'EX',
      expect.any(Number),
      'NX',
    );
  });

  it('refuse le rejeu lorsque le nonce existe déjà', async () => {
    set.mockResolvedValue(null);

    await expect(service.exchange(assertion(currentSecret))).rejects.toBeInstanceOf(UnauthorizedException);
    expect(upsert).not.toHaveBeenCalled();
  });

  it('refuse une audience ou une origine non autorisée', async () => {
    await expect(service.exchange(assertion(currentSecret, { audience: 'autre-audience' }))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    await expect(
      service.exchange(assertion(currentSecret, { origin: 'https://evil.example.com' })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(upsert).not.toHaveBeenCalled();
  });

  it('échoue fermé lorsque Redis est indisponible', async () => {
    set.mockRejectedValue(new Error('redis unavailable'));

    await expect(service.exchange(assertion(currentSecret))).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(upsert).not.toHaveBeenCalled();
  });
});

function assertion(secret: string, overrides: { audience?: string; origin?: string } = {}): string {
  return sign(
    {
      integration_id: 'integration-1',
      email: 'Client@Example.com',
      origin: overrides.origin ?? 'https://photos.example.com',
      jti: `jti-${Math.random()}`,
      display_name: 'Client Photo',
    },
    secret,
    {
      algorithm: 'HS256',
      issuer: 'site-photo',
      audience: overrides.audience ?? 'telecom-assertion',
      subject: 'wordpress-user-42',
      expiresIn: 120,
    },
  );
}
