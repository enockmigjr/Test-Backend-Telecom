import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from '../setup';
import { DrizzleProvider } from '../../src/database/drizzle.provider';
import { tickets } from '../../src/database/schemas';

describe('Comments — E2E', () => {
  let app: INestApplication;
  let agentToken: string;
  let otherAgentToken: string;
  let ticketId: string;
  let commentId: string;

  jest.setTimeout(60000);

  beforeAll(async () => {
    const { app: testApp, flushRedis } = await createTestApp();
    await flushRedis();
    app = testApp;

    const drizzle = app.get(DrizzleProvider);
    const [t] = await drizzle.db.select().from(tickets).limit(1);
    ticketId = t?.id;

    // Charger dynamiquement les utilisateurs
    const { users } = await import('../../src/database/schemas');
    const allUsers = await drizzle.db.select().from(users);
    const csAgent = allUsers.find((u) => u.role === 'CUSTOMER_SERVICE_AGENT');
    const otherAgent = allUsers.find((u) => u.role === 'NOC_ENGINEER' || u.role === 'BILLING_AGENT');

    if (!csAgent || !otherAgent) {
      throw new Error('Utilisateurs requis non trouves.');
    }

    // Logins
    const agentLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: csAgent.email, password: 'Agent@1234' });
    agentToken = agentLogin.body.data.accessToken;

    const otherAgentLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: otherAgent.email, password: 'Agent@1234' });
    otherAgentToken = otherAgentLogin.body.data.accessToken;
  });

  afterAll(async () => {
    await app.close();
  }, 60000);

  describe('POST /api/v1/tickets/:ticketId/comments', () => {
    it('doit creer un commentaire public -> 201', async () => {
      if (!ticketId) return;
      const res = await request(app.getHttpServer())
        .post(`/api/v1/tickets/${ticketId}/comments`)
        .set('Authorization', `Bearer ${agentToken}`)
        .send({ content: 'Le technicien est en route vers le site.' })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.content).toBe('Le technicien est en route vers le site.');
      commentId = res.body.data.id;
    });
  });

  describe('GET /api/v1/tickets/:ticketId/comments', () => {
    it('doit lister les commentaires du ticket -> 200', async () => {
      if (!ticketId) return;
      const res = await request(app.getHttpServer())
        .get(`/api/v1/tickets/${ticketId}/comments`)
        .set('Authorization', `Bearer ${agentToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.data)).toBe(true);
      expect(res.body.data.data.length).toBeGreaterThan(0);
    });
  });

  describe('PATCH /api/v1/comments/:id', () => {
    it('doit autoriser l auteur a modifier son commentaire -> 200', async () => {
      if (!commentId) return;
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/comments/${commentId}`)
        .set('Authorization', `Bearer ${agentToken}`)
        .send({ content: 'Commentaire mis a jour.' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.content).toBe('Commentaire mis a jour.');
    });

    it('doit interdire a un autre agent de modifier le commentaire -> 403', async () => {
      if (!commentId) return;
      await request(app.getHttpServer())
        .patch(`/api/v1/comments/${commentId}`)
        .set('Authorization', `Bearer ${otherAgentToken}`)
        .send({ content: 'Piratage !' })
        .expect(403);
    });
  });

  describe('DELETE /api/v1/comments/:id', () => {
    it('doit autoriser l auteur a supprimer son commentaire -> 204', async () => {
      if (!commentId) return;
      await request(app.getHttpServer())
        .delete(`/api/v1/comments/${commentId}`)
        .set('Authorization', `Bearer ${agentToken}`)
        .expect(204);
    });
  });
});
