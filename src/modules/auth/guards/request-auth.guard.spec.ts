import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AUTH_MODE_KEY, AuthMode } from '../../../common/decorators/auth-mode.decorator';
import { IntegrationAssertionGuard } from '../../external-identity/guards/integration-assertion.guard';
import { PublicSessionGuard } from '../../external-identity/guards/public-session.guard';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RequestAuthGuard } from './request-auth.guard';

describe('RequestAuthGuard', () => {
  const context = { getHandler: jest.fn(), getClass: jest.fn() } as unknown as ExecutionContext;
  const reflector = { getAllAndOverride: jest.fn() } as unknown as Reflector;
  const internalGuard = { canActivate: jest.fn().mockReturnValue(true) } as unknown as JwtAuthGuard;
  const publicGuard = { canActivate: jest.fn().mockReturnValue(true) } as unknown as PublicSessionGuard;
  const assertionGuard = { canActivate: jest.fn().mockReturnValue(true) } as unknown as IntegrationAssertionGuard;
  const guard = new RequestAuthGuard(reflector, internalGuard, publicGuard, assertionGuard);

  beforeEach(() => jest.clearAllMocks());

  it('considère toute route sans métadonnée comme INTERNAL', () => {
    jest.mocked(reflector.getAllAndOverride).mockReturnValue(undefined);
    expect(guard.canActivate(context)).toBe(true);
    expect(internalGuard.canActivate).toHaveBeenCalledWith(context);
  });

  it('autorise ANONYMOUS sans présenter le jeton aux gardes', () => {
    jest.mocked(reflector.getAllAndOverride).mockReturnValue(AuthMode.ANONYMOUS);
    expect(guard.canActivate(context)).toBe(true);
    expect(internalGuard.canActivate).not.toHaveBeenCalled();
    expect(publicGuard.canActivate).not.toHaveBeenCalled();
  });

  it('délègue PUBLIC_SESSION uniquement au garde public', () => {
    jest.mocked(reflector.getAllAndOverride).mockReturnValue(AuthMode.PUBLIC_SESSION);
    expect(guard.canActivate(context)).toBe(true);
    expect(publicGuard.canActivate).toHaveBeenCalledWith(context);
    expect(internalGuard.canActivate).not.toHaveBeenCalled();
  });

  it('délègue INTEGRATION_ASSERTION au validateur dédié', () => {
    jest.mocked(reflector.getAllAndOverride).mockReturnValue(AuthMode.INTEGRATION_ASSERTION);
    expect(guard.canActivate(context)).toBe(true);
    expect(assertionGuard.canActivate).toHaveBeenCalledWith(context);
    expect(internalGuard.canActivate).not.toHaveBeenCalled();
  });

  it('utilise la clé de métadonnée authMode', () => {
    jest.mocked(reflector.getAllAndOverride).mockReturnValue(AuthMode.ANONYMOUS);
    guard.canActivate(context);
    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(AUTH_MODE_KEY, expect.any(Array));
  });
});
