import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import { createTestApp } from '../setup';
import { DrizzleProvider } from '../../src/database/drizzle.provider';
import { users } from '../../src/database/schemas';

describe('Tickets Permissions — E2E fine checks', () => {
  let app: INestApplication;
  let supervisorToken: string;
  let adminToken: string;
  let csAgentToken: string; // Customer Service Agent
  let csAgentUserId: string;
  let nocAgentToken: string; // NOC Engineer (Tech)
  let nocAgentUserId: string;

  let departmentId: string;
  let assignedTeamId: string;
  let ticketId: string;
  let categoryId: string;

  jest.setTimeout(60000);

  beforeAll(async () => {
    const { app: testApp, flushRedis } = await createTestApp();
    await flushRedis();
    app = testApp;

    const drizzle = app.get(DrizzleProvider);
    const { categories, slaPolicies } = await import('../../src/database/schemas');
    const { generateUuid } = await import('../../src/common/helpers/uuidv7.helper');

    const testCatName = 'Test Permission Cat';
    const [existing] = await drizzle.db.select().from(categories).where(eq(categories.name, testCatName)).limit(1);

    if (existing) {
      categoryId = existing.id;
    } else {
      const testCatId = generateUuid();
      await drizzle.db.insert(categories).values({
        id: testCatId,
        name: testCatName,
        description: 'Categorie de test pour les permissions',
        targetRole: null,
      });
      categoryId = testCatId;

      const priorities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
      for (const p of priorities) {
        await drizzle.db
          .insert(slaPolicies)
          .values({
            id: generateUuid(),
            categoryId: testCatId,
            priority: p,
            firstResponseMinutes: 60,
            resolutionMinutes: 480,
          })
          .onConflictDoNothing();
      }
    }

    // Récupérer les identifiants
    const allUsers = await drizzle.db.select().from(users);

    const admin = allUsers.find((u) => u.email === 'admin@telecom.local');
    const supervisor = allUsers.find((u) => u.email === 'supervisor@telecom.local');
    const csAgent = allUsers.find((u) => u.email === 'agent-cc1@telecom.local');
    const nocAgent = allUsers.find((u) => u.email === 'noc1@telecom.local');

    if (!admin || !supervisor || !csAgent || !nocAgent) {
      throw new Error('Utilisateurs requis du seed introuvables.');
    }

    departmentId = csAgent.departmentId!;
    assignedTeamId = nocAgent.departmentId!;

    csAgentUserId = csAgent.id;
    nocAgentUserId = nocAgent.id;

    // Logins

    const adminLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: admin.email, password: 'Admin@1234' });
    adminToken = adminLogin.body.data.accessToken;

    const supervisorLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: supervisor.email, password: 'Super@1234' });
    supervisorToken = supervisorLogin.body.data.accessToken;

    const csLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: csAgent.email, password: 'Agent@1234' });
    csAgentToken = csLogin.body.data.accessToken;

    const nocLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: nocAgent.email, password: 'Agent@1234' });

    if (!nocLogin.body || !nocLogin.body.data || !nocLogin.body.data.accessToken) {
      console.error('NOC Login failed:', nocLogin.status, JSON.stringify(nocLogin.body, null, 2));
    }
    nocAgentToken = nocLogin.body.data.accessToken;
  });

  afterAll(async () => {
    await app.close();
  }, 60000);

  describe('Verification de l Auto-Assignation', () => {
    it('doit permettre a un agent NOC de s auto-assigner un ticket NEW non assigne -> 200', async () => {
      // 1. Créer un ticket NEW en tant que CS Agent
      const resCreate = await request(app.getHttpServer())
        .post('/api/v1/tickets')
        .set('Authorization', `Bearer ${csAgentToken}`)
        .send({
          title: 'Ticket Test Auto Assign',
          description: 'Ceci est une description.',
          priority: 'MEDIUM',
          severity: 'S3',
          categoryId: categoryId,
          departmentId,
          assignedTeamId,
        })
        .expect(201);

      ticketId = resCreate.body.data.id;

      // 2. NOC Agent s'auto-assigne (userId = son propre ID)
      const resAssign = await request(app.getHttpServer())
        .post(`/api/v1/tickets/${ticketId}/assign`)
        .set('Authorization', `Bearer ${nocAgentToken}`)
        .send({ userId: nocAgentUserId, reason: 'Je prends en charge.' })
        .expect(200);

      expect(resAssign.body.success).toBe(true);
      expect(resAssign.body.data.assignedTo).toBe(nocAgentUserId);
      expect(resAssign.body.data.status).toBe('ASSIGNED');
    });

    it('doit interdire a un autre agent NOC d assigner ce ticket deja assigne a quelqu un d autre -> 403', async () => {
      // Un agent simple ne peut pas modifier l'assignation d'un ticket déjà assigné
      await request(app.getHttpServer())
        .post(`/api/v1/tickets/${ticketId}/assign`)
        .set('Authorization', `Bearer ${csAgentToken}`)
        .send({ userId: csAgentUserId, reason: 'Changement d assignation.' })
        .expect(403);
    });

    it('refuse meme a un admin une cible hors de l equipe assignee -> 400', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/tickets/${ticketId}/assign`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ userId: csAgentUserId, reason: 'Cible incoherente avec l equipe.' })
        .expect(400);
    });

    it('refuse une escalade dont l utilisateur ne correspond pas au departement cible -> 400', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/tickets/${ticketId}/escalate`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ userId: csAgentUserId, departmentId: assignedTeamId, reason: 'Cible incoherente.' })
        .expect(400);
    });
  });

  describe('Validation des permissions fines sur les champs (PATCH)', () => {
    it('doit interdire au createur non assigne de modifier le titre apres NEW -> 403', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/tickets/${ticketId}`)
        .set('Authorization', `Bearer ${csAgentToken}`)
        .send({ title: 'Modification tardive du createur' })
        .expect(403);
    });

    it('doit autoriser l assigne (nocAgent) a modifier le titre, description, tags -> 200', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/tickets/${ticketId}`)
        .set('Authorization', `Bearer ${nocAgentToken}`)
        .send({ title: 'Titre modifie par l assigne', tags: 'optical,noc' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe('Titre modifie par l assigne');
    });

    it('doit interdire a l assigne (nocAgent) de modifier la priorite ou la severite -> 403', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/tickets/${ticketId}`)
        .set('Authorization', `Bearer ${nocAgentToken}`)
        .send({ priority: 'CRITICAL' })
        .expect(403);
    });

    it('doit autoriser le Supervisor ou l Admin a modifier la priorite -> 200', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/tickets/${ticketId}`)
        .set('Authorization', `Bearer ${supervisorToken}`)
        .send({ priority: 'CRITICAL' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.priority).toBe('CRITICAL');
    });
  });

  describe('Cloture et reouverture', () => {
    it('doit autoriser l assigne a clore son propre ticket -> 200', async () => {
      // Résoudre d'abord
      await request(app.getHttpServer())
        .post(`/api/v1/tickets/${ticketId}/start`)
        .set('Authorization', `Bearer ${nocAgentToken}`)
        .expect(200);

      await request(app.getHttpServer())
        .post(`/api/v1/tickets/${ticketId}/resolve`)
        .set('Authorization', `Bearer ${nocAgentToken}`)
        .send({ resolutionSummary: 'Intervention terminee.' })
        .expect(200);

      // Clore
      const res = await request(app.getHttpServer())
        .post(`/api/v1/tickets/${ticketId}/close`)
        .set('Authorization', `Bearer ${nocAgentToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('CLOSED');
    });

    it('doit autoriser le CS Agent (createur du ticket) a rouvrir le ticket -> 200', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/tickets/${ticketId}/reopen`)
        .set('Authorization', `Bearer ${csAgentToken}`)
        .send({ reason: 'Le client dit que le probleme est encore present.' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('REOPENED');
    });
  });
});
