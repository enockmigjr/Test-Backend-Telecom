import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from '../setup';
import { tokenFor } from '../auth.helper';

describe('Dashboard — E2E', () => {
  let app: INestApplication;
  let adminToken: string;
  let agentToken: string;

  jest.setTimeout(60000);

  beforeAll(async () => {
    const { app: testApp, flushRedis } = await createTestApp();
    await flushRedis();
    app = testApp;

    // Jetons Keycloak RS256 signés avec la clé de test (rôles du seed)
    adminToken = tokenFor('admin');
    agentToken = tokenFor('csAgent');
  });

  afterAll(async () => {
    await app.close();
  }, 60000);

  describe('Vérification des 7 endpoints dashboard', () => {
    const endpoints = [
      'overview',
      'tickets-by-status',
      'tickets-by-priority',
      'departments',
      'sla-compliance',
      'workload',
      'resolution-time',
    ];

    for (const ep of endpoints) {
      it(`GET /dashboard/${ep} — doit réussir pour l admin -> 200`, async () => {
        const res = await request(app.getHttpServer())
          .get(`/api/v1/dashboard/${ep}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(res.body.success).toBe(true);
        expect(res.body.data).toBeDefined();
      });

      it(`GET /dashboard/${ep} — doit refuser à un simple agent -> 403`, async () => {
        await request(app.getHttpServer())
          .get(`/api/v1/dashboard/${ep}`)
          .set('Authorization', `Bearer ${agentToken}`)
          .expect(403);
      });
    }
  });
});
