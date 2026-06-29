import { RolesGuard } from './roles.guard';
import { Reflector } from '@nestjs/core';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';

/**
 * Tests du RolesGuard — vérifie que seuls les rôles autorisés passent.
 */
describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  function mockContext(role?: string, requiredRoles?: string[]): ExecutionContext {
    const mockRequest = { user: role ? { role, id: '1', email: 'test@telecom.local' } : null };
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(requiredRoles || undefined);
    return {
      switchToHttp: () => ({ getRequest: () => mockRequest }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;
  }

  it('doit autoriser si aucun rôle requis (route publique implicite)', () => {
    expect(guard.canActivate(mockContext('ADMINISTRATOR', undefined))).toBe(true);
  });

  it('doit autoriser si liste de rôles vide', () => {
    expect(guard.canActivate(mockContext('ADMINISTRATOR', []))).toBe(true);
  });

  it("doit autoriser si le rôle de l'utilisateur est dans la liste", () => {
    expect(guard.canActivate(mockContext('ADMINISTRATOR', ['ADMINISTRATOR', 'SUPERVISOR']))).toBe(true);
  });

  it("doit rejeter si le rôle de l'utilisateur n'est pas dans la liste", () => {
    expect(() => guard.canActivate(mockContext('FIELD_TECHNICIAN', ['ADMINISTRATOR', 'SUPERVISOR']))).toThrow(
      ForbiddenException,
    );
  });

  it("doit rejeter si aucun utilisateur n'est authentifié", () => {
    expect(() => guard.canActivate(mockContext(undefined, ['ADMINISTRATOR']))).toThrow(ForbiddenException);
  });

  it('SUPERVISOR doit accéder aux routes supervisor/admin', () => {
    expect(guard.canActivate(mockContext('SUPERVISOR', ['ADMINISTRATOR', 'SUPERVISOR']))).toBe(true);
  });

  it('CUSTOMER_SERVICE_AGENT ne doit pas accéder aux routes admin', () => {
    expect(() => guard.canActivate(mockContext('CUSTOMER_SERVICE_AGENT', ['ADMINISTRATOR']))).toThrow(
      ForbiddenException,
    );
  });
});
