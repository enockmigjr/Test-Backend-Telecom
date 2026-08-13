/**
 * ============================================================================
 * FICHIER : src/websocket/websocket-auth.service.spec.ts
 * RÔLE : Suite de tests unitaires pour le composant websocket-auth.service.
 * EXPLICATION :
 * Ce fichier contient les tests automatisés validant le comportement et l'intégrité de websocket-auth.service.
 * 1. Vérifie le fonctionnement nominal et les cas d'erreur.
 * 2. Garantit qu'aucune régression n'est introduite lors des évolutions du code.
 * ============================================================================
 */

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

  /** Test : valide le JWT du cookie HttpOnly via la strategie HTTP complete */

  it('valide le JWT du cookie HttpOnly via la strategie HTTP complete', async () => {
    jwtService.verifyAsync.mockResolvedValue(validatedPayload);
    jwtStrategy.validate.mockResolvedValue(validatedPayload);

    await expect(service.authenticate('theme=light; access_token=signed.jwt')).resolves.toEqual(validatedPayload);
    expect(jwtService.verifyAsync).toHaveBeenCalledWith('signed.jwt');
    expect(jwtStrategy.validate).toHaveBeenCalledWith(validatedPayload);
  });

  /** Test : rejette les tokens fournis hors cookie */

  it('rejette les tokens fournis hors cookie', async () => {
    await expect(service.authenticate(undefined)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(jwtService.verifyAsync).not.toHaveBeenCalled();
  });

  /** Test : rejette les cookies dupliques pour eviter une interpretation ambigue */

  it('rejette les cookies dupliques pour eviter une interpretation ambigue', async () => {
    await expect(service.authenticate('access_token=first; access_token=second')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  /** Test : Keycloak impose le changement de mot de passe, le temps réel ne bloque plus */

  it('accepte le temps reel meme si le flag metier mustChangePassword est pose', async () => {
    jwtService.verifyAsync.mockResolvedValue(validatedPayload);
    jwtStrategy.validate.mockResolvedValue({ ...validatedPayload, mustChangePassword: true });

    await expect(service.authenticate('access_token=signed.jwt')).resolves.toMatchObject({
      ...validatedPayload,
      mustChangePassword: true,
    });
  });

  /** Test : utilise par defaut le meme cookie __Host que le BFF en production */

  it('utilise par defaut le meme cookie __Host que le BFF en production', async () => {
    process.env['NODE_ENV'] = 'production';
    jwtService.verifyAsync.mockResolvedValue(validatedPayload);
    jwtStrategy.validate.mockResolvedValue(validatedPayload);

    await expect(service.authenticate('__Host-access-token=signed.jwt')).resolves.toEqual(validatedPayload);
  });

  /** Test : rejette un nom de cookie non durci en production */

  it('rejette un nom de cookie non durci en production', async () => {
    process.env['NODE_ENV'] = 'production';
    process.env['AUTH_ACCESS_COOKIE_NAME'] = 'access_token';

    await expect(service.authenticate('access_token=signed.jwt')).rejects.toThrow('__Host-');
    expect(jwtService.verifyAsync).not.toHaveBeenCalled();
  });
});
