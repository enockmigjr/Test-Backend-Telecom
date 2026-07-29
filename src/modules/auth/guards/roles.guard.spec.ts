/**
 * ============================================================================
 * FICHIER : src/modules/auth/guards/roles.guard.spec.ts
 * RÔLE : Suite de tests unitaires pour le composant roles.guard.
 * EXPLICATION :
 * Ce fichier contient les tests automatisés validant le comportement et l'intégrité de roles.guard.
 * 1. Vérifie le fonctionnement nominal et les cas d'erreur.
 * 2. Garantit qu'aucune régression n'est introduite lors des évolutions du code.
 * ============================================================================
 */

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

  /** Test : doit autoriser si aucun rôle requis (route publique implicite) */

  it('doit autoriser si aucun rôle requis (route publique implicite)', () => {
    expect(guard.canActivate(mockContext('ADMINISTRATOR', undefined))).toBe(true);
  });

  /** Test : doit autoriser si liste de rôles vide */

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

  /** Test : SUPERVISOR doit accéder aux routes supervisor/admin */

  it('SUPERVISOR doit accéder aux routes supervisor/admin', () => {
    expect(guard.canActivate(mockContext('SUPERVISOR', ['ADMINISTRATOR', 'SUPERVISOR']))).toBe(true);
  });

  /** Test : CUSTOMER_SERVICE_AGENT ne doit pas accéder aux routes admin */

  it('CUSTOMER_SERVICE_AGENT ne doit pas accéder aux routes admin', () => {
    expect(() => guard.canActivate(mockContext('CUSTOMER_SERVICE_AGENT', ['ADMINISTRATOR']))).toThrow(
      ForbiddenException,
    );
  });
});
