import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from '../setup';
import { DrizzleProvider } from '../../src/database/drizzle.provider';
import { tickets, users } from '../../src/database/schemas';

describe('Internal Notes — E2E', () => {
  let app: INestApplication;
  let supervisorToken: string;
  let fieldTechToken: string;
  let ticketId: string;
  let noteId: string;

  jest.setTimeout(60000);

  beforeAll(async () => {
    const { app: testApp, flushRedis } = await createTestApp();
    await flushRedis();
    app = testApp;

    const drizzle = app.get(DrizzleProvider);
    const [t] = await drizzle.db.select().from(tickets).limit(1);
    ticketId = t?.id;

    // Login Supervisor (autorisé)
    const supervisorLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'supervisor@telecom.local', password: 'Super@1234' });
    supervisorToken = supervisorLogin.body.data.accessToken;

    // Trouver un field tech dans le seed
    const allUsers = await drizzle.db.select().from(users);
    const tech = allUsers.find((u) => u.email === 'field1@telecom.local');
    const techEmail = tech?.email || 'field1@telecom.local';

    const techLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: techEmail, password: 'Agent@1234' });
    fieldTechToken = techLogin.body.data?.accessToken;
  });

  afterAll(async () => {
    await app.close();
  }, 60000);

  describe('Accès restreint aux FIELD_TECHNICIAN', () => {
    it('doit refuser la creation de note interne pour un FIELD_TECHNICIAN -> 403', async () => {
      if (!ticketId || !fieldTechToken) return;
      await request(app.getHttpServer())
        .post(`/api/v1/tickets/${ticketId}/internal-notes`)
        .set('Authorization', `Bearer ${fieldTechToken}`)
        .send({ content: 'Note confidentielle du terrain.' })
        .expect(403);
    });

    it('doit refuser le listing des notes internes pour un FIELD_TECHNICIAN -> 403', async () => {
      if (!ticketId || !fieldTechToken) return;
      await request(app.getHttpServer())
        .get(`/api/v1/tickets/${ticketId}/internal-notes`)
        .set('Authorization', `Bearer ${fieldTechToken}`)
        .expect(403);
    });
  });

  describe('Accès autorisé pour les autres rôles', () => {
    it('doit autoriser le Supervisor a creer une note interne -> 201', async () => {
      if (!ticketId) return;
      const res = await request(app.getHttpServer())
        .post(`/api/v1/tickets/${ticketId}/internal-notes`)
        .set('Authorization', `Bearer ${supervisorToken}`)
        .send({ content: 'Diagnostic interne NOC : liaison optique affectee.' })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.content).toBe('Diagnostic interne NOC : liaison optique affectee.');
      noteId = res.body.data.id;
    });

    it('doit autoriser le Supervisor a lister les notes -> 200', async () => {
      if (!ticketId) return;
      const res = await request(app.getHttpServer())
        .get(`/api/v1/tickets/${ticketId}/internal-notes`)
        .set('Authorization', `Bearer ${supervisorToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.data.length).toBeGreaterThan(0);
    });

    it('doit autoriser l auteur a modifier la note interne -> 200', async () => {
      if (!noteId) return;
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/internal-notes/${noteId}`)
        .set('Authorization', `Bearer ${supervisorToken}`)
        .send({ content: 'Diagnostic mis a jour.' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.message).toBe('Note interne mise à jour.');
    });

    it('doit autoriser la suppression de la note interne -> 204', async () => {
      if (!noteId) return;
      await request(app.getHttpServer())
        .delete(`/api/v1/internal-notes/${noteId}`)
        .set('Authorization', `Bearer ${supervisorToken}`)
        .expect(204);
    });
  });
});
