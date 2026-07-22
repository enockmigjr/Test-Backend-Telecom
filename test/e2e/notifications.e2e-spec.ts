import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from '../setup';
import { DrizzleProvider } from '../../src/database/drizzle.provider';
import { users } from '../../src/database/schemas';

describe('Notifications — E2E', () => {
  let app: INestApplication;
  let agentToken: string;
  let notifId: string;

  jest.setTimeout(60000);

  beforeAll(async () => {
    const { app: testApp, flushRedis } = await createTestApp();
    await flushRedis();
    app = testApp;

    const drizzle = app.get(DrizzleProvider);
    const allUsers = await drizzle.db.select().from(users);
    const csAgent = allUsers.find((u) => u.email === 'agent-cc1@telecom.local');

    if (!csAgent) {
      throw new Error('CS Agent requis non trouve dans le seed.');
    }

    // Login Agent
    const agentLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: csAgent.email, password: 'Agent@1234' });
    agentToken = agentLogin.body.data.accessToken;
  });

  afterAll(async () => {
    await app.close();
  }, 60000);

  describe('GET /api/v1/notifications', () => {
    it('doit lister toutes les notifications de l utilisateur -> 200', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/notifications')
        .set('Authorization', `Bearer ${agentToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.meta).toBeDefined();
      if (res.body.data.length > 0) {
        notifId = res.body.data[0].id;
      }
    });

    it('doit lister les notifications non lues -> 200', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/notifications/unread')
        .set('Authorization', `Bearer ${agentToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe('PATCH /api/v1/notifications/:id/read et read-all', () => {
    it('doit marquer une notification comme lue -> 200', async () => {
      if (!notifId) return;
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/notifications/${notifId}/read`)
        .set('Authorization', `Bearer ${agentToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
    });

    it('doit marquer toutes les notifications comme lues -> 200', async () => {
      const res = await request(app.getHttpServer())
        .patch('/api/v1/notifications/read-all')
        .set('Authorization', `Bearer ${agentToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
    });
  });
});
