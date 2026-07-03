import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from '../setup';
import { DrizzleProvider } from '../../src/database/drizzle.provider';
import { tickets, users } from '../../src/database/schemas';

describe('Reports — E2E', () => {
  let app: INestApplication;
  let adminToken: string;
  let agentToken: string;
  let ticketId: string;

  jest.setTimeout(60000);

  beforeAll(async () => {
    const { app: testApp, flushRedis } = await createTestApp();
    await flushRedis();
    app = testApp;

    const drizzle = app.get(DrizzleProvider);
    const [t] = await drizzle.db.select().from(tickets).limit(1);
    ticketId = t?.id;

    // Login Admin
    const allUsers = await drizzle.db.select().from(users);
    const admin = allUsers.find((u) => u.email === 'admin@telecom.local');
    const csAgent = allUsers.find((u) => u.email === 'agent-cc1@telecom.local');

    if (!admin || !csAgent) {
      throw new Error('Utilisateurs requis non trouves.');
    }

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

  describe('Routes synchrones JSON (GET)', () => {
    it('GET /reports/ticket/:id — doit retourner les donnees du rapport ticket -> 200', async () => {
      if (!ticketId) return;
      const res = await request(app.getHttpServer())
        .get(`/api/v1/reports/ticket/${ticketId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.ticket.id).toBe(ticketId);
    });

    it('GET /reports/ticket/:id — 404 si ticket inexistant', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/reports/ticket/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });

    it('GET /reports/sla — doit retourner les metriques SLA -> 200', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/reports/sla')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.summary).toBeDefined();
    });
  });

  describe('Routes asynchrones PDF (POST)', () => {
    it('POST /reports/ticket/:id/generate — doit enqueuer le job PDF -> 202', async () => {
      if (!ticketId) return;
      const res = await request(app.getHttpServer())
        .post(`/api/v1/reports/ticket/${ticketId}/generate`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(202);

      expect(res.body.data.message).toContain('en cours de generation');
    });

    it('POST /reports/sla/generate — doit enqueuer le job SLA PDF -> 202', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/reports/sla/generate')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(202);

      expect(res.body.data.message).toContain('en cours de generation');
    });
  });

  describe('Permissions d acces aux rapports', () => {
    it('doit refuser d acces a un simple agent -> 403', async () => {
      if (!ticketId) return;
      await request(app.getHttpServer())
        .get(`/api/v1/reports/ticket/${ticketId}`)
        .set('Authorization', `Bearer ${agentToken}`)
        .expect(403);
    });
  });
});
