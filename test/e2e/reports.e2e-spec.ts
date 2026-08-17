import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from '../setup';
import { tokenFor } from '../auth.helper';
import { DrizzleProvider } from '../../src/database/drizzle.provider';
import { tickets } from '../../src/database/schemas';

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

    // Jetons Keycloak RS256 signés avec la clé de test (rôles du seed)
    adminToken = tokenFor('admin');
    agentToken = tokenFor('csAgent');
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

      expect(res.body.message).toContain('en cours de génération');
    });

    it('POST /reports/sla/generate — doit enqueuer le job SLA PDF -> 202', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/reports/sla/generate')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(202);

      expect(res.body.message).toContain('en cours de génération');
    });

    it('POST /reports/weekly/generate — doit enqueuer le job hebdomadaire PDF -> 202', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/reports/weekly/generate')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(202);

      expect(res.body.message).toContain('en cours de génération');
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
