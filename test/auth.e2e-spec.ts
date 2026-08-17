import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { generateKeyPairSync } from 'node:crypto';
import * as jwt from 'jsonwebtoken';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { KeycloakJwksService } from '../src/modules/auth/services/keycloak-jwks.service';

/**
 * Tests E2E du flux d'authentification Keycloak-only.
 *
 * Scénarios couverts :
 * 1. Requête protégée sans jeton → 401
 * 2. Jeton RS256 valide (clé générée dans le test, JWKS stubé) → 200 + profil
 * 3. Jeton avec signature altérée → 401
 *
 * Prérequis : base de données seedée (le profil admin@telecom.local est lié au
 * sujet Keycloak par email vérifié au premier login).
 */
describe('Auth — Flux E2E Keycloak', () => {
  let app: INestApplication;
  let keyPair: ReturnType<typeof generateKeyPairSync>;

  jest.setTimeout(60_000);

  beforeAll(async () => {
    keyPair = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const publicKeyPem = keyPair.publicKey.export({ type: 'spki', format: 'pem' }).toString();
    process.env['KEYCLOAK_ISSUER'] = 'http://keycloak.test/realms/telecom';
    process.env['KEYCLOAK_JWKS_URL'] = 'http://keycloak.test/realms/telecom/protocol/openid-connect/certs';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(KeycloakJwksService)
      .useValue({ publicKey: jest.fn().mockResolvedValue(publicKeyPem) })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    app.setGlobalPrefix('api/v1');
    app.useGlobalFilters(new GlobalExceptionFilter());
    app.useGlobalInterceptors(new TransformInterceptor());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  }, 60_000);

  function signToken(payload: Record<string, unknown>): string {
    return jwt.sign(payload, keyPair.privateKey, { algorithm: 'RS256', keyid: 'test-key' });
  }

  function validPayload(overrides: Record<string, unknown> = {}) {
    return {
      sub: 'kc-e2e-subject',
      email: 'admin@telecom.local',
      email_verified: true,
      jti: `jti-${Date.now()}`,
      iss: 'http://keycloak.test/realms/telecom',
      realm_access: { roles: ['ADMINISTRATOR'] },
      exp: Math.floor(Date.now() / 1000) + 900,
      ...overrides,
    };
  }

  it('retourne 401 sans jeton', async () => {
    await request(app.getHttpServer()).get('/api/v1/auth/me').expect(401);
  });

  it('retourne le profil métier avec un jeton RS256 valide', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${signToken(validPayload())}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.email).toBe('admin@telecom.local');
    expect(res.body.data.role).toBe('ADMINISTRATOR');
  });

  it('retourne 401 avec une signature altérée', async () => {
    const token = signToken(validPayload());
    const tampered = `${token.slice(0, -4)}xxxx`;
    await request(app.getHttpServer()).get('/api/v1/auth/me').set('Authorization', `Bearer ${tampered}`).expect(401);
  });
});
