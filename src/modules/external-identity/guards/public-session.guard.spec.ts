import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PublicSessionService } from '../services/public-session.service';
import { TrustedDeviceService } from '../services/trusted-device.service';
import { PublicSessionGuard } from './public-session.guard';

function context(headers: Record<string, string>) {
  const request = { header: (name: string) => headers[name.toLowerCase()] };
  return {
    request,
    execution: {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext,
  };
}

describe('PublicSessionGuard', () => {
  const reflector = { getAllAndOverride: jest.fn() } as unknown as Reflector;
  const sessions = { validate: jest.fn() } as unknown as PublicSessionService;
  const devices = { authenticate: jest.fn() } as unknown as TrustedDeviceService;
  const guard = new PublicSessionGuard(reflector, sessions, devices);

  beforeEach(() => jest.clearAllMocks());

  it('valide le Bearer public sur une route de session ordinaire', async () => {
    jest.mocked(reflector.getAllAndOverride).mockReturnValue(false);
    jest.mocked(sessions.validate).mockResolvedValue({
      kind: 'PUBLIC',
      sub: 'requester-1',
      externalRequesterId: 'requester-1',
      supportIntegrationId: 'integration-1',
      deviceId: 'device-1',
      jti: 'jti-1',
    });
    const { execution, request } = context({ authorization: 'Bearer public-token' });

    await expect(guard.canActivate(execution)).resolves.toBe(true);
    expect(sessions.validate).toHaveBeenCalledWith('public-token');
    expect(request).toHaveProperty('user.externalRequesterId', 'requester-1');
  });

  it('refuse de restaurer avec le seul Bearer, sans jeton opaque', async () => {
    jest.mocked(reflector.getAllAndOverride).mockReturnValue(true);
    const { execution } = context({ authorization: 'Bearer public-token' });

    await expect(guard.canActivate(execution)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(sessions.validate).not.toHaveBeenCalled();
    expect(devices.authenticate).not.toHaveBeenCalled();
  });

  it('restaure uniquement avec le jeton opaque et la clé publique d’intégration', async () => {
    jest.mocked(reflector.getAllAndOverride).mockReturnValue(true);
    jest.mocked(devices.authenticate).mockResolvedValue({
      id: 'device-1',
      externalRequesterId: 'requester-1',
      supportIntegrationId: 'integration-1',
      policyVersion: 1,
      expiresAt: new Date(Date.now() + 60_000),
      trustPolicy: { policyVersion: 1 },
    });
    const { execution, request } = context({
      'x-trusted-device': 'opaque-token',
      'x-integration-key': 'site-photo',
    });

    await expect(guard.canActivate(execution)).resolves.toBe(true);
    expect(devices.authenticate).toHaveBeenCalledWith('site-photo', 'opaque-token');
    expect(request).toHaveProperty('user.deviceId', 'device-1');
  });
});
