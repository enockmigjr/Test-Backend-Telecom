import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from '../setup';

describe('Dashboard — E2E (DB réelle)', () => {
  let app: INestApplication;
  let adminToken: string;

  beforeAll(async () => {
    const { app: testApp, flushRedis } = await createTestApp();
    await flushRedis();
    app = testApp;

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'admin@telecom.local', password: 'Admin@1234' });
    if (login.body.success) adminToken = login.body.data.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /dashboard/overview — KPIs globaux (200)', async () => {
    if (!adminToken) return;
    const res = await request(app.getHttpServer())
      .get('/api/v1/dashboard/overview')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.ticketVolume).toBeDefined();
  });

  it('GET /dashboard/workload — charge agents (200)', async () => {
    if (!adminToken) return;
    const res = await request(app.getHttpServer())
      .get('/api/v1/dashboard/workload')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.summary).toBeDefined();
  });

  it('GET /dashboard/tickets-by-status — tickets par statut (200)', async () => {
    if (!adminToken) return;
    const res = await request(app.getHttpServer())
      .get('/api/v1/dashboard/tickets-by-status')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body.success).toBe(true);
  });

  it('GET /dashboard sans admin — 403', async () => {
    // Login en tant qu'agent
    const agentLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'agent-cc@telecom.local', password: 'Agent@1234' });
    const agentToken = agentLogin.body.data?.accessToken;
    if (!agentToken) return;

    await request(app.getHttpServer())
      .get('/api/v1/dashboard/overview')
      .set('Authorization', `Bearer ${agentToken}`)
      .expect(403);
  });
});
