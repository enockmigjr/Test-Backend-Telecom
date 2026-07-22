import { UnauthorizedException } from '@nestjs/common';
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
  let service: WebSocketAuthService;
  let jwtService: MockProxy<JwtService>;
  let jwtStrategy: MockProxy<JwtStrategy>;

  beforeEach(() => {
    jwtService = mock<JwtService>();
    jwtStrategy = mock<JwtStrategy>();
    service = new WebSocketAuthService(jwtService, jwtStrategy);
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
});
