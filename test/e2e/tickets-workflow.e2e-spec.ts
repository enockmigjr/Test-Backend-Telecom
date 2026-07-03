import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from '../setup';
import { DrizzleProvider } from '../../src/database/drizzle.provider';
import { departments, users } from '../../src/database/schemas';

describe('Tickets — Workflow E2E complet', () => {
  let app: INestApplication;
  let adminToken: string;
  let createdTicketId: string;
  let departmentId: string;
  let assignedTeamId: string;
  let agentUserId: string;

  jest.setTimeout(60000);

  beforeAll(async () => {
    const { app: testApp, flushRedis } = await createTestApp();
    await flushRedis();
    app = testApp;

    const drizzle = app.get(DrizzleProvider);
    const depts = await drizzle.db.select().from(departments).limit(2);
    departmentId = depts[0]?.id;
    assignedTeamId = depts[1]?.id || depts[0]?.id;

    // Charger les utilisateurs
    const allUsers = await drizzle.db.select().from(users);
    const agent = allUsers.find((u) => u.email === 'agent-cc1@telecom.local');
    const admin = allUsers.find((u) => u.email === 'admin@telecom.local');

    if (!agent || !admin) {
      throw new Error('Utilisateurs requis non trouves.');
    }

    agentUserId = agent.id;

    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: admin.email, password: 'Admin@1234' });

    adminToken = loginRes.body?.data?.accessToken || '';
  });

  afterAll(async () => {
    await app.close();
  }, 60000);

  describe("POST /api/v1/tickets — Creation d'un ticket", () => {
    it('doit retourner 201 avec les details du ticket cree', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/tickets')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Coupure fibre optique secteur Nord',
          description: 'Les clients du secteur Nord signalent une perte de connectivite totale depuis 14h30.',
          priority: 'HIGH',
          severity: 'S2',
          category: 'NETWORK',
          departmentId,
          assignedTeamId,
          customerAccountNumber: 'CUST-12345',
          customerName: 'Entreprise ABC',
          customerContact: 'contact@abc.local',
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();

      const ticket = res.body.data;
      expect(ticket.id).toBeDefined();
      expect(ticket.ticketNumber).toBeDefined();
      expect(ticket.title).toBe('Coupure fibre optique secteur Nord');
      expect(ticket.status).toBe('NEW');
      createdTicketId = ticket.id;
    });
  });

  describe('POST /api/v1/tickets/:id/assign — Assignation', () => {
    it('doit retourner 200 pour une assignation valide', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/tickets/${createdTicketId}/assign`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          userId: agentUserId,
          reason: 'Competence reseau requise',
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('ASSIGNED');
    });
  });

  describe('Transitions PENDING — En attente', () => {
    it('doit pouvoir passer en PENDING_CUSTOMER puis revenir en IN_PROGRESS', async () => {
      // 1. Démarrer le traitement
      await request(app.getHttpServer())
        .post(`/api/v1/tickets/${createdTicketId}/start`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // 2. Mettre en attente client
      const resPending = await request(app.getHttpServer())
        .post(`/api/v1/tickets/${createdTicketId}/pending-customer`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'En attente du plan d acces client.' })
        .expect(200);

      expect(resPending.body.data.status).toBe('PENDING_CUSTOMER');

      // 3. Revenir en cours
      const resStart = await request(app.getHttpServer())
        .post(`/api/v1/tickets/${createdTicketId}/start`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(resStart.body.data.status).toBe('IN_PROGRESS');
    });

    it('doit pouvoir passer en PENDING_THIRD_PARTY puis revenir en IN_PROGRESS', async () => {
      // 1. Mettre en attente tiers
      const resPending = await request(app.getHttpServer())
        .post(`/api/v1/tickets/${createdTicketId}/pending-third-party`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'En attente intervention technicien Orange.' })
        .expect(200);

      expect(resPending.body.data.status).toBe('PENDING_THIRD_PARTY');

      // 2. Revenir en cours
      const resStart = await request(app.getHttpServer())
        .post(`/api/v1/tickets/${createdTicketId}/start`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(resStart.body.data.status).toBe('IN_PROGRESS');
    });
  });

  describe('POST /api/v1/tickets/:id/resolve — Resolution', () => {
    it('doit resoudre le ticket en fournissant un resume -> 200', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/tickets/${createdTicketId}/resolve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ resolutionSummary: 'Probleme resolu par soudure fibre sur la jarretiere Nord.' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('RESOLVED');
      expect(res.body.data.resolutionSummary).toBe('Probleme resolu par soudure fibre sur la jarretiere Nord.');
    });
  });

  describe('POST /api/v1/tickets/:id/close — Cloture', () => {
    it('doit fermer le ticket resolu -> 200', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/tickets/${createdTicketId}/close`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('CLOSED');
    });
  });

  describe('POST /api/v1/tickets/:id/reopen — Reouverture', () => {
    it('doit rouvrir le ticket en exigeant une raison valide -> 200', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/tickets/${createdTicketId}/reopen`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Le client signale que les coupures recommencent.' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('REOPENED');
    });

    it('doit rejeter la reouverture si la raison est absente ou trop courte -> 400', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/tickets/${createdTicketId}/reopen`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'court' })
        .expect(400);
    });
  });
});
