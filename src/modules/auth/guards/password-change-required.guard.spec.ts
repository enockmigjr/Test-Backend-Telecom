import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AUTH_MODE_KEY, AuthMode } from '../../../common/decorators/auth-mode.decorator';
import { PasswordChangeRequiredGuard } from './password-change-required.guard';

describe('PasswordChangeRequiredGuard et AuthMode', () => {
  const reflector = { getAllAndOverride: jest.fn() } as unknown as Reflector;
  const request = { user: { mustChangePassword: true } };
  const context = {
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  const guard = new PasswordChangeRequiredGuard(reflector);

  beforeEach(() => jest.clearAllMocks());

  it.each([AuthMode.ANONYMOUS, AuthMode.PUBLIC_SESSION, AuthMode.INTEGRATION_ASSERTION])(
    'ignore la politique mot de passe pour %s',
    (mode) => {
      jest.mocked(reflector.getAllAndOverride).mockImplementation((key) => (key === AUTH_MODE_KEY ? mode : undefined));
      expect(guard.canActivate(context)).toBe(true);
    },
  );
});
