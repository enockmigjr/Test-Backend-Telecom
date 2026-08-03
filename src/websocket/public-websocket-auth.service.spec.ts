import { UnauthorizedException } from '@nestjs/common';
import { mock, MockProxy } from 'jest-mock-extended';
import { PublicSessionService } from '../modules/external-identity/services/public-session.service';
import { PublicWebSocketAuthService } from './public-websocket-auth.service';
import { Test } from '@nestjs/testing';

describe('PublicWebSocketAuthService', () => {
  const originalEnv = process.env;
  let sessions: MockProxy<PublicSessionService>;
  let service: PublicWebSocketAuthService;

  beforeEach(async () => {
    process.env = { ...originalEnv, NODE_ENV: 'test' };
    delete process.env['PUBLIC_WS_COOKIE_NAME'];
    sessions = mock<PublicSessionService>();
    process.env['PUBLIC_SUPPORT_ORIGINS'] = 'https://portal.example.test';
    const moduleRef = await Test.createTestingModule({
      providers: [PublicWebSocketAuthService, { provide: PublicSessionService, useValue: sessions }],
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
      service.authenticate('theme=light; support_session=opaque%2Etoken', 'https://portal.example.test', 'portal'),
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

    await service.authenticate('support_iframe_session=iframe-token', 'https://portal.example.test', 'widget');

    expect(sessions.validate).toHaveBeenCalledWith('iframe-token');
  });

  it.each([
    [undefined, 'https://portal.example.test', 'portal' as const],
    ['support_session=token', undefined, 'portal' as const],
    ['support_session=first; support_session=second', 'https://portal.example.test', 'portal' as const],
    ['support_session=%E0%A4%A', 'https://portal.example.test', 'portal' as const],
    ['support_session=token', 'https://portal.example.test', null],
  ])('rejette une authentification ambigue ou incomplete', async (cookie, origin, context) => {
    await expect(service.authenticate(cookie, origin, context)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(sessions.validate).not.toHaveBeenCalled();
  });

  it('sélectionne le cookie demandé même si les deux contextes coexistent', async () => {
    sessions.validate.mockResolvedValue({
      kind: 'PUBLIC',
      sub: 'requester-001',
      supportIntegrationId: 'integration-001',
      externalRequesterId: 'requester-001',
      jti: 'session-001',
    });

    await service.authenticate(
      'support_session=portal-token; support_iframe_session=widget-token',
      'https://portal.example.test',
      'widget',
    );

    expect(sessions.validate).toHaveBeenCalledWith('widget-token');
  });

  it('impose un cookie __Host en production', async () => {
    process.env['NODE_ENV'] = 'production';
    process.env['PUBLIC_WS_COOKIE_NAME'] = 'support_session,__Host-support_iframe_session';
    await expect(
      service.authenticate('support_session=token', 'https://portal.example.test', 'portal'),
    ).rejects.toThrow('__Host-');
    expect(sessions.validate).not.toHaveBeenCalled();
  });

  it('rejette un site hôte même autorisé pour l’iframe car le socket doit venir du portail', async () => {
    sessions.validate.mockResolvedValue({
      kind: 'PUBLIC',
      sub: 'requester-001',
      supportIntegrationId: 'integration-001',
      externalRequesterId: 'requester-001',
      jti: 'session-001',
    });

    await expect(
      service.authenticate('support_session=token', 'https://widget.example.test', 'portal'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(sessions.validate).not.toHaveBeenCalled();
  });
});
