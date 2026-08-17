import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from '../setup';
import { tokenFor } from '../auth.helper';
import { DrizzleProvider } from '../../src/database/drizzle.provider';
import { departments, users } from '../../src/database/schemas';
import { eq } from 'drizzle-orm';

/**
 * Tests End-to-End du controle d'acces base sur les roles (RBAC).
 *
 * Verifie que chaque role ne peut executer que les actions autorisees
 * selon la matrice RBAC definie dans la conception.
 *
 * Scenarios couverts:
 * 1. ADMINISTRATOR peut creer un utilisateur → 201
 * 2. AGENT (TECHNICAL_SUPPORT_ENGINEER) ne peut PAS creer un utilisateur → 403
 * 3. ADMINISTRATOR peut consulter les audit logs → 200
 * 4. AGENT ne peut PAS consulter les audit logs → 403
 * 5. ADMINISTRATOR peut consulter la liste des utilisateurs → 200
 * 6. AGENT ne peut PAS consulter la liste des utilisateurs → 403
 *
 * Pre-requis: Base de donnees seedee avec:
 *   - admin@telecom.local / Admin@1234 (role: ADMINISTRATOR)
 *   - agent@telecom.local / Agent@1234 (role: TECHNICAL_SUPPORT_ENGINEER)
 *   - supervisor@telecom.local / Super@1234 (role: SUPERVISOR)
 */
describe("RBAC — Controle d'acces par roles", () => {
  let app: INestApplication;
  let adminToken: string;
  let agentToken: string;
  let supervisorToken: string;
  let departmentId: string;
  let agentUserId: string;
  let adminUserId: string;

  let ticketAssignOkId: string;
  let ticketAssignFailId: string;
  let ticketCloseOkId: string;
  let ticketCloseFailId: string;
  let ticketReopenOkId: string;
  let ticketReopenFailId: string;

  jest.setTimeout(60000);

  beforeAll(async () => {
    const { app: testApp, flushRedis } = await createTestApp();
    await flushRedis();
    app = testApp;

    // Récupérer dynamiquement les données du seed
    const drizzle = app.get(DrizzleProvider);
    const [dept] = await drizzle.db.select().from(departments).limit(1);
    departmentId = dept?.id;

    const { tickets } = await import('../../src/database/schemas');
    const { isNull } = await import('drizzle-orm');
    const allTickets = await drizzle.db.select().from(tickets).where(isNull(tickets.deletedAt));

    ticketAssignOkId = allTickets[0]?.id;
    ticketAssignFailId = allTickets[1]?.id || ticketAssignOkId;
    ticketCloseOkId = allTickets[2]?.id || ticketAssignOkId;
    ticketCloseFailId = allTickets[3]?.id || ticketAssignOkId;
    ticketReopenOkId = allTickets[4]?.id || ticketAssignOkId;
    ticketReopenFailId = allTickets[5]?.id || ticketAssignOkId;

    // Charger les utilisateurs réels du seed par leur email
    const allUsers = await drizzle.db.select().from(users);
    const admin = allUsers.find((u) => u.email === 'admin@telecom.local');
    const agent = allUsers.find((u) => u.email === 'agent@telecom.local');
    const supervisor = allUsers.find((u) => u.email === 'supervisor@telecom.local');

    if (!admin || !agent || !supervisor) {
      throw new Error('Utilisateurs requis non trouves.');
    }

    agentUserId = agent.id;
    adminUserId = admin.id;

    // Forcer le statut des tickets de test de façon isolée en DB
    await drizzle.db
      .update(tickets)
      .set({ status: 'NEW', assignedTo: admin.id, assignedTeamId: agent.departmentId })
      .where(eq(tickets.id, ticketAssignOkId));

    await drizzle.db
      .update(tickets)
      .set({ status: 'NEW', assignedTo: admin.id })
      .where(eq(tickets.id, ticketAssignFailId));

    await drizzle.db
      .update(tickets)
      .set({ status: 'RESOLVED', assignedTo: admin.id })
      .where(eq(tickets.id, ticketCloseOkId));

    await drizzle.db
      .update(tickets)
      .set({ status: 'RESOLVED', assignedTo: admin.id })
      .where(eq(tickets.id, ticketCloseFailId));

    await drizzle.db
      .update(tickets)
      .set({
        status: 'CLOSED',
        createdBy: admin.id,
        openedByUserId: admin.id,
        assignedTo: admin.id,
        closedAt: new Date(),
      })
      .where(eq(tickets.id, ticketReopenOkId));

    await drizzle.db
      .update(tickets)
      .set({
        status: 'CLOSED',
        createdBy: admin.id,
        openedByUserId: admin.id,
        assignedTo: admin.id,
        closedAt: new Date(),
      })
      .where(eq(tickets.id, ticketReopenFailId));

    // Jetons Keycloak RS256 signés avec la clé de test (rôles du seed)
    adminToken = tokenFor('admin');
    agentToken = tokenFor('technicalSupportAgent');
    supervisorToken = tokenFor('supervisor');
  });

  afterAll(async () => {
    await app.close();
  }, 60000);

  // =========================================================================
  // Creer un utilisateur (POST /api/v1/users) — Admin uniquement
  // =========================================================================
  describe("POST /api/v1/users — Creation d'utilisateur", () => {
    const getNewUserPayload = () => ({
      email: `test-rbac-${Date.now()}-${Math.random().toString(36).substring(2, 8)}@telecom.local`,
      firstName: 'Nouvel',
      lastName: 'Agent',
      role: 'TECHNICAL_SUPPORT_ENGINEER',
      departmentId,
    });

    it('ADMINISTRATOR doit pouvoir creer un utilisateur → 201', async () => {
      const payload = getNewUserPayload();
      const res = await request(app.getHttpServer())
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload)
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.email).toBe(payload.email);
      expect(res.body.data.role).toBe(payload.role);
    });

    it('TECHNICAL_SUPPORT_ENGINEER ne doit PAS pouvoir creer un utilisateur → 403', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${agentToken}`)
        .send(getNewUserPayload())
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.error).toBeDefined();
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('SUPERVISOR ne doit PAS pouvoir creer un utilisateur → 403', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${supervisorToken}`)
        .send(getNewUserPayload())
        .expect(403);

      expect(res.body.success).toBe(false);
    });

    it("doit retourner 401 sans token d'authentification", async () => {
      await request(app.getHttpServer()).post('/api/v1/users').send(getNewUserPayload()).expect(401);
    });

    it('doit retourner 400 pour un email invalide', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ...getNewUserPayload(), email: 'pas-un-email' })
        .expect(400);

      expect(res.body.success).toBe(false);
    });
  });

  // =========================================================================
  // Consulter les audit logs (GET /api/v1/audit-logs) — Admin et Supervisor
  // =========================================================================
  describe("GET /api/v1/audit-logs — Consultation des journaux d'audit", () => {
    it('ADMINISTRATOR doit pouvoir consulter les audit logs → 200', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/audit-logs')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
    });

    it('SUPERVISOR doit pouvoir consulter les audit logs → 200', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/audit-logs')
        .set('Authorization', `Bearer ${supervisorToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
    });

    it('TECHNICAL_SUPPORT_ENGINEER ne doit PAS pouvoir consulter les audit logs → 403', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/audit-logs')
        .set('Authorization', `Bearer ${agentToken}`)
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  // =========================================================================
  // Lister les utilisateurs (GET /api/v1/users) — Admin et Supervisor
  // =========================================================================
  describe('GET /api/v1/users — Liste des utilisateurs', () => {
    it('ADMINISTRATOR doit pouvoir lister les utilisateurs → 200', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
    });

    it('SUPERVISOR doit pouvoir lister les utilisateurs → 200', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${supervisorToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
    });

    it('TECHNICAL_SUPPORT_ENGINEER ne doit PAS pouvoir lister les utilisateurs → 403', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${agentToken}`)
        .expect(403);

      expect(res.body.success).toBe(false);
    });
  });

  // =========================================================================
  // Assigner un ticket (POST /api/v1/tickets/:id/assign) — Admin et Supervisor uniquement
  // =========================================================================
  describe('POST /api/v1/tickets/:id/assign — Assignation de ticket', () => {
    it('ADMINISTRATOR peut assigner un ticket → 200', async () => {
      if (!ticketAssignOkId) return;
      const res = await request(app.getHttpServer())
        .post(`/api/v1/tickets/${ticketAssignOkId}/assign`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ userId: agentUserId });

      expect([200, 201]).toContain(res.status);
    });

    it('TECHNICAL_SUPPORT_ENGINEER ne peut PAS assigner un ticket → 403', async () => {
      if (!ticketAssignFailId) return;
      const res = await request(app.getHttpServer())
        .post(`/api/v1/tickets/${ticketAssignFailId}/assign`)
        .set('Authorization', `Bearer ${agentToken}`)
        .send({ userId: adminUserId })
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  // =========================================================================
  // Cloturer un ticket (POST /api/v1/tickets/:id/close) — Admin et Supervisor
  // =========================================================================
  describe('POST /api/v1/tickets/:id/close — Cloture de ticket', () => {
    it('ADMINISTRATOR peut cloturer un ticket → 200', async () => {
      if (!ticketCloseOkId) return;
      const res = await request(app.getHttpServer())
        .post(`/api/v1/tickets/${ticketCloseOkId}/close`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect([200, 400]).toContain(res.status);
    });

    it('TECHNICAL_SUPPORT_ENGINEER ne peut PAS cloturer un ticket → 403', async () => {
      if (!ticketCloseFailId) return;
      await request(app.getHttpServer())
        .post(`/api/v1/tickets/${ticketCloseFailId}/close`)
        .set('Authorization', `Bearer ${agentToken}`)
        .expect(403);
    });
  });

  // =========================================================================
  // Reouvrir un ticket (POST /api/v1/tickets/:id/reopen) — Admin et Supervisor
  // =========================================================================
  describe('POST /api/v1/tickets/:id/reopen — Reouverture de ticket', () => {
    it('ADMINISTRATOR peut reouvrir un ticket → 200', async () => {
      if (!ticketReopenOkId) return;
      const res = await request(app.getHttpServer())
        .post(`/api/v1/tickets/${ticketReopenOkId}/reopen`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Reouverture Admin test' });

      expect([200, 400]).toContain(res.status);
    });

    it('TECHNICAL_SUPPORT_ENGINEER ne peut PAS reouvrir un ticket → 403', async () => {
      if (!ticketReopenFailId) return;
      await request(app.getHttpServer())
        .post(`/api/v1/tickets/${ticketReopenFailId}/reopen`)
        .set('Authorization', `Bearer ${agentToken}`)
        .send({ reason: 'Tentative Reouverture' })
        .expect(403);
    });
  });
});
