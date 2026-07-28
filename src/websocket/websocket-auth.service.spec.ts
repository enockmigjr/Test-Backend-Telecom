import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { mock, MockProxy } from 'jest-mock-extended';

import { JwtPayload } from '../modules/auth/interfaces/jwt-payload.interface';
import { JwtStrategy } from '../modules/auth/strategies/jwt.strategy';
import { WebSocketAuthService } from './websocket-auth.service';

const validatedPayload = {
  sub: 'user-001',
  id: 'user-001',
  email: 'agent@telecom.local',
  role: 'CUSTOMER_SERVICE_AGENT' as const,
  departmentId: 'dept-001',
  mustChangePassword: false,
  jti: 'jti-001',
  sessionIssuedAt: 1_784_554_400_000,
} satisfies JwtPayload;

describe('WebSocketAuthService', () => {
  const originalEnv = process.env;
  let service: WebSocketAuthService;
  let jwtService: MockProxy<JwtService>;
  let jwtStrategy: MockProxy<JwtStrategy>;

  beforeEach(() => {
    process.env = { ...originalEnv, NODE_ENV: 'test' };
    delete process.env['AUTH_ACCESS_COOKIE_NAME'];
    jwtService = mock<JwtService>();
    jwtStrategy = mock<JwtStrategy>();
    service = new WebSocketAuthService(jwtService, jwtStrategy);
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('valide le JWT du cookie HttpOnly via la strategie HTTP complete', async () => {
    jwtService.verifyAsync.mockResolvedValue(validatedPayload);
    jwtStrategy.validate.mockResolvedValue(validatedPayload);

    await expect(service.authenticate('theme=light; access_token=signed.jwt')).resolves.toEqual(validatedPayload);
    expect(jwtService.verifyAsync).toHaveBeenCalledWith('signed.jwt');
    expect(jwtStrategy.validate).toHaveBeenCalledWith(validatedPayload);
  });

  it('rejette les tokens fournis hors cookie', async () => {
    await expect(service.authenticate(undefined)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(jwtService.verifyAsync).not.toHaveBeenCalled();
  });

  it('rejette les cookies dupliques pour eviter une interpretation ambigue', async () => {
    await expect(service.authenticate('access_token=first; access_token=second')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejette le temps reel tant que le mot de passe temporaire doit etre change', async () => {
    jwtService.verifyAsync.mockResolvedValue(validatedPayload);
    jwtStrategy.validate.mockResolvedValue({ ...validatedPayload, mustChangePassword: true });

    await expect(service.authenticate('access_token=signed.jwt')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('utilise par defaut le meme cookie __Host que le BFF en production', async () => {
    process.env['NODE_ENV'] = 'production';
    jwtService.verifyAsync.mockResolvedValue(validatedPayload);
    jwtStrategy.validate.mockResolvedValue(validatedPayload);

    await expect(service.authenticate('__Host-access-token=signed.jwt')).resolves.toEqual(validatedPayload);
  });

  it('rejette un nom de cookie non durci en production', async () => {
    process.env['NODE_ENV'] = 'production';
    process.env['AUTH_ACCESS_COOKIE_NAME'] = 'access_token';

    await expect(service.authenticate('access_token=signed.jwt')).rejects.toThrow('__Host-');
    expect(jwtService.verifyAsync).not.toHaveBeenCalled();
  });
});
