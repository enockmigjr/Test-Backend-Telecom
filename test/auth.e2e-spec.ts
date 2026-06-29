import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';

/**
 * Tests End-to-End du flux d'authentification.
 *
 * Scénarios couverts:
 * 1. Login avec identifiants valides → 200 + tokens
 * 2. Login avec mauvais mot de passe → 401
 * 3. Login avec email inexistant → 401
 * 4. Refresh token → 200 + nouveaux tokens
 * 5. Refresh avec token invalide → 401
 * 6. Logout → 204
 * 7. Changement de mot de passe → 200
 *
 * Prérequis: Base de données seedée avec l'utilisateur admin@telecom.local
 */
describe('Auth — Flux E2E', () => {
  let app: INestApplication;
  let accessToken: string;
  let refreshToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Configurer comme en production
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    app.useGlobalFilters(new GlobalExceptionFilter());
    app.useGlobalInterceptors(new TransformInterceptor());

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/v1/auth/login', () => {
    it('doit retourner 200 et les tokens pour des identifiants valides', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'admin@telecom.local', password: 'Admin@1234' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined();
      expect(res.body.data.user).toBeDefined();
      expect(res.body.data.user.email).toBe('admin@telecom.local');
      expect(res.body.data.user.role).toBe('ADMINISTRATOR');

      // Sauvegarder pour les tests suivants
      accessToken = res.body.data.accessToken;
      refreshToken = res.body.data.refreshToken;
    });

    it('doit retourner 401 pour un mot de passe incorrect', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'admin@telecom.local', password: 'MauvaisMotDePasse' })
        .expect(401);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('doit retourner 401 pour un email inexistant', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'inexistant@telecom.local', password: 'Test@1234' })
        .expect(401);

      expect(res.body.success).toBe(false);
    });

    it('doit retourner 400 pour un email invalide', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'pas-un-email', password: 'Test@1234' })
        .expect(400);

      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/auth/refresh', () => {
    it('doit retourner 200 avec de nouveaux tokens pour un refresh token valide', async () => {
      const res = await request(app.getHttpServer()).post('/api/v1/auth/refresh').send({ refreshToken }).expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined();

      // Mettre à jour les tokens
      accessToken = res.body.data.accessToken;
      refreshToken = res.body.data.refreshToken;
    });

    it('doit retourner 401 pour un refresh token invalide', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: 'token-invalide-12345' })
        .expect(401);

      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/auth/me', () => {
    it('doit retourner 200 avec le profil pour un utilisateur authentifié', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.email).toBe('admin@telecom.local');
    });

    it('doit retourner 401 sans token', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/auth/me').expect(401);

      expect(res.body.success).toBe(false);
    });
  });

  describe('PUT /api/v1/auth/change-password', () => {
    it('doit retourner 200 pour un changement de mot de passe valide', async () => {
      const res = await request(app.getHttpServer())
        .put('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ currentPassword: 'Admin@1234', newPassword: 'NewAdmin@1234' })
        .expect(200);

      expect(res.body.success).toBe(true);

      // Remettre l'ancien mot de passe pour les autres tests
      await request(app.getHttpServer())
        .put('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ currentPassword: 'NewAdmin@1234', newPassword: 'Admin@1234' })
        .expect(200);
    });

    it('doit retourner 401 pour un mauvais mot de passe actuel', async () => {
      const res = await request(app.getHttpServer())
        .put('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ currentPassword: 'MauvaisMotDePasse', newPassword: 'Test@1234' })
        .expect(401);

      expect(res.body.success).toBe(false);
    });
  });
});
