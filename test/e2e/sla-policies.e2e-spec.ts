import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from '../setup';
import { DrizzleProvider } from '../../src/database/drizzle.provider';
import { users } from '../../src/database/schemas';

describe('SLA Policies — E2E', () => {
  let app: INestApplication;
  let adminToken: string;
  let agentToken: string;
  let createdPolicyId: string;

  jest.setTimeout(60000);

  beforeAll(async () => {
    const { app: testApp, flushRedis } = await createTestApp();
    await flushRedis();
    app = testApp;

    const drizzle = app.get(DrizzleProvider);
    const allUsers = await drizzle.db.select().from(users);
    const admin = allUsers.find((u) => u.role === 'ADMINISTRATOR');
    const csAgent = allUsers.find((u) => u.role === 'CUSTOMER_SERVICE_AGENT');

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

  describe('GET /api/v1/sla-policies', () => {
    it('doit lister toutes les politiques SLA pour un utilisateur authentifie -> 200', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/sla-policies')
        .set('Authorization', `Bearer ${agentToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
    });
  });

  describe('POST /api/v1/sla-policies', () => {
    it('doit interdire la creation a un simple agent -> 403', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/sla-policies')
        .set('Authorization', `Bearer ${agentToken}`)
        .send({
          category: 'OTHER',
          priority: 'LOW',
          firstResponseMinutes: 60,
          resolutionMinutes: 300,
        })
        .expect(403);
    });

    it('doit autoriser l admin a creer une nouvelle politique SLA (si non doublon) -> 201 ou 409', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/sla-policies')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          category: 'HARDWARE',
          priority: 'CRITICAL',
          firstResponseMinutes: 10,
          resolutionMinutes: 60,
        });

      expect([201, 409]).toContain(res.status);
      if (res.status === 201) {
        expect(res.body.success).toBe(true);
        createdPolicyId = res.body.data.id;
      }
    });
  });

  describe('PATCH /api/v1/sla-policies/:id', () => {
    it('doit autoriser l admin a modifier une politique SLA -> 200', async () => {
      const list = await request(app.getHttpServer())
        .get('/api/v1/sla-policies')
        .set('Authorization', `Bearer ${adminToken}`);
      const policyId = createdPolicyId || list.body.data[0]?.id;
      if (!policyId) return;

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/sla-policies/${policyId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ firstResponseMinutes: 99 })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.firstResponseMinutes).toBe(99);
    });
  });
});
