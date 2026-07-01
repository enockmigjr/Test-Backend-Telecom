import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import { createTestApp } from '../setup';
import { DrizzleProvider } from '../../src/database/drizzle.provider';
import { departments, users } from '../../src/database/schemas';

/**
 * Tests End-to-End du cycle de vie complet d'un ticket d'incident.
 *
 * Scenarios couverts:
 * 1. Creation d'un ticket → 201
 * 2. Assignation a un agent → 200
 * 3. Resolution du ticket → 200
 * 4. Cloture du ticket → 200
 * 5. Reouverture du ticket → 200
 * 6. Consultation de l'historique → 200
 *
 * Pre-requis: Base de donnees seedee avec:
 *   - Utilisateur admin: admin@telecom.local / Admin@1234 (role: ADMINISTRATOR)
 *   - Utilisateur agent: agent@telecom.local / Agent@1234 (role: TECHNICAL_SUPPORT_ENGINEER)
 *   - Departements: Support Technique (ID dept-001), NOC (ID dept-002)
 *   - Politique SLA avec ID sla-pol-001
 *
 * Note: Le global prefix est 'api/v1' (defini dans AppConfigService).
 */
describe('Tickets — Workflow E2E', () => {
  let app: INestApplication;
  let adminToken: string;
  let createdTicketId: string;
  let departmentId: string;
  let assignedTeamId: string;
  let agentUserId: string;

  // Augmenter le timeout global pour l'initialisation et le nettoyage
  jest.setTimeout(30000);

  beforeAll(async () => {
    const { app: testApp, flushRedis } = await createTestApp();
    await flushRedis();
    app = testApp;

    // Récupérer dynamiquement les données du seed
    const drizzle = app.get(DrizzleProvider);
    const depts = await drizzle.db.select().from(departments).limit(2);
    departmentId = depts[0]?.id;
    assignedTeamId = depts[1]?.id || depts[0]?.id;

    const [agent] = await drizzle.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, 'agent@telecom.local'))
      .limit(1);
    agentUserId = agent?.id;

    // Authentification admin pour les operations superviseur
    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'admin@telecom.local', password: 'Admin@1234' });

    adminToken = loginRes.body?.data?.accessToken || '';
  });

  afterAll(async () => {
    await app.close();
  });

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

      // Verifier que les champs obligatoires sont presents
      const ticket = res.body.data;
      expect(ticket.id).toBeDefined();
      expect(ticket.ticketNumber).toBeDefined();
      expect(ticket.title).toBe('Coupure fibre optique secteur Nord');
      expect(ticket.status).toBe('NEW');
      expect(ticket.priority).toBe('HIGH');
      expect(ticket.severity).toBe('S2');
      expect(ticket.category).toBe('NETWORK');
      expect(ticket.createdBy).toBeDefined();

      // Sauvegarder pour les tests suivants
      createdTicketId = ticket.id;
    });

    it('doit retourner 400 pour des donnees incompletes', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/tickets')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Ticket sans description',
          // description manquante
          priority: 'HIGH',
          severity: 'S2',
          category: 'NETWORK',
          departmentId,
          assignedTeamId,
        })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('doit retourner 400 pour une priorite invalide', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/tickets')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Ticket priorite invalide',
          description: 'Test de validation',
          priority: 'URGENT', // Valeur invalide
          severity: 'S2',
          category: 'NETWORK',
          departmentId,
          assignedTeamId,
        })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it("doit retourner 401 sans token d'authentification", async () => {
      await request(app.getHttpServer())
        .post('/api/v1/tickets')
        .send({
          title: 'Ticket non authentifie',
          description: 'Devrait etre refuse',
          priority: 'MEDIUM',
          severity: 'S3',
          category: 'OTHER',
          departmentId,
          assignedTeamId,
        })
        .expect(401);
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
      expect(res.body.data.assignedTo).toBeDefined();
    });

    it('doit retourner 404 pour un ticket inexistant', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/tickets/00000000-0000-0000-0000-000000000000/assign')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          userId: agentUserId,
        })
        .expect(404);
    });
  });

  describe('POST /api/v1/tickets/:id/resolve — Resolution', () => {
    it('doit passer en IN_PROGRESS puis en RESOLVED', async () => {
      // Étape 1 : passer en IN_PROGRESS (transition ASSIGNED → IN_PROGRESS)
      const inProgressRes = await request(app.getHttpServer())
        .post(`/api/v1/tickets/${createdTicketId}/start`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(inProgressRes.body.success).toBe(true);
      expect(inProgressRes.body.data.status).toBe('IN_PROGRESS');

      // Étape 2 : résoudre (transition IN_PROGRESS → RESOLVED)
      const res = await request(app.getHttpServer())
        .post(`/api/v1/tickets/${createdTicketId}/resolve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('RESOLVED');
    });
  });

  describe('POST /api/v1/tickets/:id/close — Cloture', () => {
    it('doit retourner 200 pour une cloture valide (depuis RESOLVED)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/tickets/${createdTicketId}/close`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('CLOSED');
    });
  });

  describe('POST /api/v1/tickets/:id/reopen — Reouverture', () => {
    it('doit retourner 200 pour une reouverture valide (depuis CLOSED)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/tickets/${createdTicketId}/reopen`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('REOPENED');
    });
  });

  describe('GET /api/v1/tickets/:id/history — Historique', () => {
    it("doit retourner 200 avec l'historique du ticket", async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/tickets/${createdTicketId}/history`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      const history = res.body.data;
      expect(Array.isArray(history)).toBe(true);

      // L'historique contient les actions (TICKET_CREATED, ASSIGNED, STATUS_CHANGED...)
      expect(history.length).toBeGreaterThanOrEqual(1);
      const actions = history.map((entry: { action?: string }) => entry.action).filter(Boolean);
      expect(actions.length).toBeGreaterThanOrEqual(1);
      expect(actions).toContain('TICKET_CREATED');
    });

    it('doit retourner 401 sans authentification', async () => {
      await request(app.getHttpServer()).get(`/api/v1/tickets/${createdTicketId}/history`).expect(401);
    });
  });

  describe('Recherche — GET /api/v1/tickets', () => {
    it('doit retourner 200 avec la liste des tickets', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/tickets')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ page: 1, limit: 20 })
        .expect(200);

      expect(res.body.success).toBe(true);

      // La reponse peut etre paginee
      if (res.body.data && Array.isArray(res.body.data)) {
        expect(res.body.data.length).toBeGreaterThanOrEqual(0);
      }
      if (res.body.meta) {
        expect(res.body.meta.page).toBe(1);
        expect(res.body.meta.limit).toBe(20);
      }
    });
  });
});
