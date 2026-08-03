import { UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { sign, verify } from 'jsonwebtoken';
import { PublicSupportConfigService } from '../../../config/public-support.config';
import { DrizzleProvider } from '../../../database/drizzle.provider';
import { PublicSessionService } from './public-session.service';

function query(result: readonly unknown[]) {
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

describe('PublicSessionService', () => {
  const config = {
    publicSessionSecret: 'public-session-secret-long-de-32-caracteres',
    publicSessionIssuer: 'telecom-public-support',
    publicSessionAudience: 'telecom-public-bff',
    publicSessionTtlSeconds: 900,
  };
  const select = jest.fn();
  let service: PublicSessionService;

  beforeEach(async () => {
    jest.clearAllMocks();
    select
      .mockReturnValueOnce(query([{ requesterId: 'requester-1' }]))
      .mockReturnValueOnce(query([{ policyVersion: 1, trustPolicy: { policyVersion: 1 } }]));
    const moduleRef = await Test.createTestingModule({
      providers: [
        PublicSessionService,
        { provide: PublicSupportConfigService, useValue: config },
        { provide: DrizzleProvider, useValue: { db: { select } } },
      ],
    }).compile();
    service = moduleRef.get(PublicSessionService);
  });

  it('émet un JWT public isolé par kind, issuer et audience', () => {
    const token = service.issue('requester-1', 'integration-1', 'device-1');
    const payload = verify(token, config.publicSessionSecret, {
      issuer: config.publicSessionIssuer,
      audience: config.publicSessionAudience,
      algorithms: ['HS256'],
    });

    expect(payload).toEqual(
      expect.objectContaining({
        kind: 'PUBLIC',
        sub: 'requester-1',
        integrationId: 'integration-1',
        deviceId: 'device-1',
        jti: expect.any(String),
      }),
    );
    expect(service.expiresInSeconds).toBe(900);
    expect(() => verify(token, 'internal-access-secret-long-de-32-caracteres')).toThrow();
  });

  it('valide le demandeur et l’appareil actifs', async () => {
    const token = service.issue('requester-1', 'integration-1', 'device-1');
    await expect(service.validate(token)).resolves.toEqual(
      expect.objectContaining({
        kind: 'PUBLIC',
        externalRequesterId: 'requester-1',
        supportIntegrationId: 'integration-1',
        deviceId: 'device-1',
      }),
    );
  });

  it('refuse une audience étrangère même avec la clé publique', async () => {
    const token = sign(
      { kind: 'PUBLIC', integrationId: 'integration-1', deviceId: 'device-1', jti: 'jti-1' },
      config.publicSessionSecret,
      { subject: 'requester-1', issuer: config.publicSessionIssuer, audience: 'autre-bff', expiresIn: 900 },
    );
    await expect(service.validate(token)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('refuse cryptographiquement un JWT interne signé avec une autre clé', async () => {
    const internalToken = sign(
      { email: 'agent@example.com', role: 'ADMINISTRATOR', jti: 'internal-jti' },
      'internal-access-secret-long-de-32-caracteres',
      { subject: 'internal-user-1', expiresIn: 900 },
    );
    await expect(service.validate(internalToken)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('invalide immédiatement une session liée à un appareil révoqué', async () => {
    select.mockReset();
    select.mockReturnValueOnce(query([{ requesterId: 'requester-1' }])).mockReturnValueOnce(query([]));
    const token = service.issue('requester-1', 'integration-1', 'device-1');
    await expect(service.validate(token)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
