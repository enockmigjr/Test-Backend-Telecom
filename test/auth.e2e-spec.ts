import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './setup';
import { JwtService } from '@nestjs/jwt';
import { eq } from 'drizzle-orm';
import { DrizzleProvider } from '../src/database/drizzle.provider';
import { users } from '../src/database/schemas';

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

  jest.setTimeout(60000);

  beforeAll(async () => {
    const { app: testApp, flushRedis } = await createTestApp();
    await flushRedis();
    app = testApp;
  });

  afterAll(async () => {
    await app.close();
  }, 60000);

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

    it('doit refuser un compte desactive -> 403', async () => {
      const drizzle = app.get(DrizzleProvider);
      await drizzle.db.update(users).set({ isActive: false }).where(eq(users.email, 'admin@telecom.local'));

      try {
        await request(app.getHttpServer())
          .post('/api/v1/auth/login')
          .send({ email: 'admin@telecom.local', password: 'Admin@1234' })
          .expect(403);
      } finally {
        await drizzle.db.update(users).set({ isActive: true }).where(eq(users.email, 'admin@telecom.local'));
      }
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

    it('autorise un seul gagnant concurrent puis revoque la famille compromise', async () => {
      const login = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'admin@telecom.local', password: 'Admin@1234' })
        .expect(200);
      const concurrentToken = login.body.data.refreshToken as string;

      const responses = await Promise.all([
        request(app.getHttpServer()).post('/api/v1/auth/refresh').send({ refreshToken: concurrentToken }),
        request(app.getHttpServer()).post('/api/v1/auth/refresh').send({ refreshToken: concurrentToken }),
      ]);
      expect(responses.map((response) => response.status).sort()).toEqual([200, 401]);

      const winner = responses.find((response) => response.status === 200);
      await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: winner?.body.data.refreshToken })
        .expect(401);
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

    it('doit retourner 401 avec un access token expire', async () => {
      const jwt = app.get(JwtService);
      const expiredToken = jwt.sign(
        {
          sub: '00000000-0000-0000-0000-000000000001',
          email: 'admin@telecom.local',
          role: 'ADMINISTRATOR',
          departmentId: '00000000-0000-0000-0000-000000000002',
          mustChangePassword: false,
          jti: '00000000-0000-0000-0000-000000000003',
        },
        {
          secret: process.env['JWT_ACCESS_SECRET'] || 'dev-access-secret-change-in-production',
          expiresIn: -1,
        },
      );

      await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);
    });

    it('bloque les routes metier mais conserve me pendant le changement obligatoire', async () => {
      const drizzle = app.get(DrizzleProvider);
      await drizzle.db.update(users).set({ mustChangePassword: true }).where(eq(users.email, 'admin@telecom.local'));

      try {
        const login = await request(app.getHttpServer())
          .post('/api/v1/auth/login')
          .send({ email: 'admin@telecom.local', password: 'Admin@1234' })
          .expect(200);
        const temporaryAccess = login.body.data.accessToken as string;

        await request(app.getHttpServer())
          .get('/api/v1/auth/me')
          .set('Authorization', `Bearer ${temporaryAccess}`)
          .expect(200);
        const blocked = await request(app.getHttpServer())
          .get('/api/v1/dashboard/overview')
          .set('Authorization', `Bearer ${temporaryAccess}`)
          .expect(403);
        expect(blocked.body.error.code).toBe('PASSWORD_CHANGE_REQUIRED');
      } finally {
        await drizzle.db.update(users).set({ mustChangePassword: false }).where(eq(users.email, 'admin@telecom.local'));
      }
    });

    it('autorise la deconnexion pendant le changement obligatoire', async () => {
      const drizzle = app.get(DrizzleProvider);
      await drizzle.db.update(users).set({ mustChangePassword: true }).where(eq(users.email, 'admin@telecom.local'));

      try {
        const login = await request(app.getHttpServer())
          .post('/api/v1/auth/login')
          .send({ email: 'admin@telecom.local', password: 'Admin@1234' })
          .expect(200);
        await request(app.getHttpServer())
          .post('/api/v1/auth/logout')
          .set('Authorization', `Bearer ${login.body.data.accessToken as string}`)
          .send({ refreshToken: login.body.data.refreshToken })
          .expect(204);
      } finally {
        await drizzle.db.update(users).set({ mustChangePassword: false }).where(eq(users.email, 'admin@telecom.local'));
      }
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

  describe('POST /api/v1/auth/logout-all', () => {
    it('serialise un refresh concurrent et ne laisse aucun successeur actif', async () => {
      const login = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'admin@telecom.local', password: 'Admin@1234' })
        .expect(200);

      const [logoutResponse, refreshResponse] = await Promise.all([
        request(app.getHttpServer())
          .post('/api/v1/auth/logout-all')
          .set('Authorization', `Bearer ${login.body.data.accessToken as string}`),
        request(app.getHttpServer()).post('/api/v1/auth/refresh').send({ refreshToken: login.body.data.refreshToken }),
      ]);

      expect(logoutResponse.status).toBe(204);
      expect([200, 401]).toContain(refreshResponse.status);
      if (refreshResponse.status === 200) {
        await request(app.getHttpServer())
          .get('/api/v1/auth/me')
          .set('Authorization', `Bearer ${refreshResponse.body.data.accessToken as string}`)
          .expect(401);
        await request(app.getHttpServer())
          .post('/api/v1/auth/refresh')
          .send({ refreshToken: refreshResponse.body.data.refreshToken })
          .expect(401);
      }
    });

    it('revoque les refresh tokens de toutes les sessions', async () => {
      const first = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'admin@telecom.local', password: 'Admin@1234' })
        .expect(200);
      const second = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'admin@telecom.local', password: 'Admin@1234' })
        .expect(200);

      await request(app.getHttpServer())
        .post('/api/v1/auth/logout-all')
        .set('Authorization', `Bearer ${first.body.data.accessToken as string}`)
        .expect(204);

      await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: first.body.data.refreshToken })
        .expect(401);
      await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: second.body.data.refreshToken })
        .expect(401);
      await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${second.body.data.accessToken as string}`)
        .expect(401);
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    it('doit reussir avec 204 et invalider l access token', async () => {
      const login = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'admin@telecom.local', password: 'Admin@1234' })
        .expect(200);
      const logoutAccessToken = login.body.data.accessToken as string;
      const logoutRefreshToken = login.body.data.refreshToken as string;

      // 1. Déconnexion
      await request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${logoutAccessToken}`)
        .send({ refreshToken: logoutRefreshToken })
        .expect(204);

      // 2. Tenter d'accéder à /me avec le même access token doit maintenant échouer (401)
      const res = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${logoutAccessToken}`)
        .expect(401);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });
  });
});
