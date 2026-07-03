import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from '../setup';

describe('Audit Logs — E2E', () => {
  let app: INestApplication;
  let adminToken: string;
  let agentToken: string;

  jest.setTimeout(60000);

  beforeAll(async () => {
    const { app: testApp, flushRedis } = await createTestApp();
    await flushRedis();
    app = testApp;

    // Charger les utilisateurs
    const { DrizzleProvider } = await import('../../src/database/drizzle.provider');
    const { users } = await import('../../src/database/schemas');
    const drizzle = app.get(DrizzleProvider);
    const allUsers = await drizzle.db.select().from(users);
    const admin = allUsers.find((u) => u.email === 'admin@telecom.local');
    const csAgent = allUsers.find((u) => u.email === 'agent-cc1@telecom.local');

    if (!admin || !csAgent) {
      throw new Error('Utilisateurs requis non trouves.');
    }

    // Login Admin
    const adminLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: admin.email, password: 'Admin@1234' });
    adminToken = adminLogin.body.data.accessToken;

    // Login Agent
    const agentLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: csAgent.email, password: 'Agent@1234' });
    agentToken = agentLogin.body.data.accessToken;
  });

  afterAll(async () => {
    await app.close();
  }, 60000);

  describe('GET /api/v1/audit-logs', () => {
    it('doit autoriser l admin a lire les logs -> 200', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/audit-logs')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.data)).toBe(true);
    });

    it('doit refuser d acces a un agent simple -> 403', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/audit-logs')
        .set('Authorization', `Bearer ${agentToken}`)
        .expect(403);
    });
  });
});
