import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from '../setup';
import { tokenFor } from '../auth.helper';
import { DrizzleProvider } from '../../src/database/drizzle.provider';
import { departments } from '../../src/database/schemas';

describe('Users — E2E', () => {
  let app: INestApplication;
  let adminToken: string;
  let supervisorToken: string;
  let agentToken: string;
  let departmentId: string;
  let createdUserId: string;

  jest.setTimeout(60000);

  beforeAll(async () => {
    const { app: testApp, flushRedis } = await createTestApp();
    await flushRedis();
    app = testApp;

    const drizzle = app.get(DrizzleProvider);
    const [dept] = await drizzle.db.select().from(departments).limit(1);
    departmentId = dept.id;

    // Jetons Keycloak RS256 signés avec la clé de test (rôles du seed)
    adminToken = tokenFor('admin');
    supervisorToken = tokenFor('supervisor');
    agentToken = tokenFor('csAgent');
  });

  afterAll(async () => {
    await app.close();
  }, 60000);

  describe('GET /api/v1/users', () => {
    it('doit autoriser l admin a lister les utilisateurs -> 200', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.meta).toBeDefined();
    });

    it('doit autoriser le supervisor a lister les utilisateurs -> 200', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${supervisorToken}`)
        .expect(200);
    });

    it('doit interdire a un agent simple de lister les utilisateurs -> 403', async () => {
      await request(app.getHttpServer()).get('/api/v1/users').set('Authorization', `Bearer ${agentToken}`).expect(403);
    });
  });

  describe('POST /api/v1/users', () => {
    it('doit autoriser l admin a creer un utilisateur -> 201', async () => {
      const email = `agent.noc.${Date.now()}@telecom.local`;
      const res = await request(app.getHttpServer())
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email,
          firstName: 'Pierre',
          lastName: 'Dupont',
          role: 'NOC_ENGINEER',
          departmentId,
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.email).toBe(email);
      createdUserId = res.body.data.id;
    });

    it('doit refuser la creation si l email existe deja -> 409', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: 'admin@telecom.local',
          firstName: 'Pierre',
          lastName: 'Dupont',
          role: 'NOC_ENGINEER',
          departmentId,
        })
        .expect(409);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('CONFLICT');
    });
  });

  describe('GET /api/v1/users/:id', () => {
    it('doit retourner le detail de l utilisateur -> 200', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/users/${createdUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(createdUserId);
    });
  });

  describe('PATCH /api/v1/users/:id/deactivate et /activate', () => {
    it('doit desactiver l utilisateur puis l activer -> 200', async () => {
      // 1. Désactiver
      await request(app.getHttpServer())
        .patch(`/api/v1/users/${createdUserId}/deactivate`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Vérifier deactiver
      const resGet = await request(app.getHttpServer())
        .get(`/api/v1/users/${createdUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(resGet.body.data.isActive).toBe(false);

      // 2. Activer
      await request(app.getHttpServer())
        .patch(`/api/v1/users/${createdUserId}/activate`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Vérifier active
      const resGet2 = await request(app.getHttpServer())
        .get(`/api/v1/users/${createdUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(resGet2.body.data.isActive).toBe(true);
    });
  });
});
