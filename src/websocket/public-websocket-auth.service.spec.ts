import { UnauthorizedException } from '@nestjs/common';
import { mock, MockProxy } from 'jest-mock-extended';
import { PublicSessionService } from '../modules/external-identity/services/public-session.service';
import { PublicWebSocketAuthService } from './public-websocket-auth.service';
import { DrizzleProvider } from '../database/drizzle.provider';
import { Test } from '@nestjs/testing';

describe('PublicWebSocketAuthService', () => {
  const originalEnv = process.env;
  let sessions: MockProxy<PublicSessionService>;
  let service: PublicWebSocketAuthService;
  const select = jest.fn();

  beforeEach(async () => {
    process.env = { ...originalEnv, NODE_ENV: 'test' };
    delete process.env['PUBLIC_WS_COOKIE_NAME'];
    sessions = mock<PublicSessionService>();
    const query = {
      from: jest.fn(),
      where: jest.fn(),
      limit: jest.fn().mockResolvedValue([{ allowedOrigins: ['https://widget.example.test'] }]),
    };
    query.from.mockReturnValue(query);
    query.where.mockReturnValue(query);
    const drizzle = { db: { select } };
    select.mockReturnValue(query);
    const moduleRef = await Test.createTestingModule({
      providers: [
        PublicWebSocketAuthService,
        { provide: PublicSessionService, useValue: sessions },
        { provide: DrizzleProvider, useValue: drizzle },
      ],
    }).compile();
    service = moduleRef.get(PublicWebSocketAuthService);
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('valide exactement le cookie public HttpOnly avec une origine', async () => {
    const principal = {
      kind: 'PUBLIC' as const,
      sub: 'requester-001',
      supportIntegrationId: 'integration-001',
      externalRequesterId: 'requester-001',
      jti: 'session-001',
    };
    sessions.validate.mockResolvedValue(principal);

    await expect(
      service.authenticate('theme=light; support_session=opaque%2Etoken', 'https://widget.example.test'),
    ).resolves.toEqual(principal);
    expect(sessions.validate).toHaveBeenCalledWith('opaque.token');
  });

  it('accepte le cookie iframe public distinct', async () => {
    sessions.validate.mockResolvedValue({
      kind: 'PUBLIC',
      sub: 'requester-001',
      supportIntegrationId: 'integration-001',
      externalRequesterId: 'requester-001',
      jti: 'session-001',
    });

    await service.authenticate('support_iframe=iframe-token', 'https://widget.example.test');

    expect(sessions.validate).toHaveBeenCalledWith('iframe-token');
  });

  it.each([
    [undefined, 'https://widget.example.test'],
    ['support_session=token', undefined],
    ['support_session=first; support_session=second', 'https://widget.example.test'],
    ['support_session=first; support_iframe=second', 'https://widget.example.test'],
    ['support_session=%E0%A4%A', 'https://widget.example.test'],
  ])('rejette une authentification ambigue ou incomplete', async (cookie, origin) => {
    await expect(service.authenticate(cookie, origin)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(sessions.validate).not.toHaveBeenCalled();
  });

  it('impose un cookie __Host en production', async () => {
    process.env['NODE_ENV'] = 'production';
    process.env['PUBLIC_WS_COOKIE_NAME'] = 'support_session,__Host-support_iframe';
    await expect(service.authenticate('support_session=token', 'https://widget.example.test')).rejects.toThrow(
      '__Host-',
    );
    expect(sessions.validate).not.toHaveBeenCalled();
  });
});
