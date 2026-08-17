/**
 * Tests unitaires de l'authentification WebSocket.
 * La signature RS256 est déléguée à KeycloakTokenVerifierService (mocké ici,
 * testé séparément avec une vraie paire de clés) ; ce fichier vérifie le
 * contrat du service : cookie, stratégie métier et cas d'erreur.
 */

import { UnauthorizedException } from '@nestjs/common';
import { mock, MockProxy } from 'jest-mock-extended';

import { JwtPayload } from '../modules/auth/interfaces/jwt-payload.interface';
import { KeycloakTokenVerifierService } from '../modules/auth/services/keycloak-token-verifier.service';
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
  sessionIssuedAt: undefined,
} satisfies JwtPayload;

describe('WebSocketAuthService', () => {
  const originalEnv = process.env;
  let service: WebSocketAuthService;
  let tokenVerifier: MockProxy<KeycloakTokenVerifierService>;
  let jwtStrategy: MockProxy<JwtStrategy>;

  beforeEach(() => {
    process.env = { ...originalEnv, NODE_ENV: 'test' };
    delete process.env['AUTH_ACCESS_COOKIE_NAME'];
    tokenVerifier = mock<KeycloakTokenVerifierService>();
    jwtStrategy = mock<JwtStrategy>();
    service = new WebSocketAuthService(tokenVerifier, jwtStrategy);
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('valide le jeton RS256 du cookie via le vérificateur puis la stratégie', async () => {
    tokenVerifier.verify.mockResolvedValue(validatedPayload);
    jwtStrategy.validate.mockResolvedValue(validatedPayload);

    await expect(service.authenticate('theme=light; access_token=signed.jwt')).resolves.toEqual(validatedPayload);
    expect(tokenVerifier.verify).toHaveBeenCalledWith('signed.jwt');
    expect(jwtStrategy.validate).toHaveBeenCalledWith(validatedPayload);
  });

  it('rejette les tokens fournis hors cookie', async () => {
    await expect(service.authenticate(undefined)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(tokenVerifier.verify).not.toHaveBeenCalled();
  });

  it('rejette les cookies dupliqués pour éviter une interprétation ambiguë', async () => {
    await expect(service.authenticate('access_token=first; access_token=second')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('accepte le temps réel même si le flag métier mustChangePassword est posé', async () => {
    tokenVerifier.verify.mockResolvedValue(validatedPayload);
    jwtStrategy.validate.mockResolvedValue({ ...validatedPayload, mustChangePassword: true });

    await expect(service.authenticate('access_token=signed.jwt')).resolves.toMatchObject({
      ...validatedPayload,
      mustChangePassword: true,
    });
  });

  it('utilise par défaut le même cookie __Host que le BFF en production', async () => {
    process.env['NODE_ENV'] = 'production';
    tokenVerifier.verify.mockResolvedValue(validatedPayload);
    jwtStrategy.validate.mockResolvedValue(validatedPayload);

    await expect(service.authenticate('__Host-access-token=signed.jwt')).resolves.toEqual(validatedPayload);
  });

  it('rejette un nom de cookie non durci en production', async () => {
    process.env['NODE_ENV'] = 'production';
    process.env['AUTH_ACCESS_COOKIE_NAME'] = 'access_token';

    await expect(service.authenticate('access_token=signed.jwt')).rejects.toThrow('__Host-');
    expect(tokenVerifier.verify).not.toHaveBeenCalled();
  });
});
