/* eslint-disable @typescript-eslint/no-explicit-any */
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from '../setup';
import { DrizzleProvider } from '../../src/database/drizzle.provider';
import { users, departments, tickets } from '../../src/database/schemas';
import { eq } from 'drizzle-orm';

describe('Supervisor & Agent Isolation — E2E', () => {
  let app: INestApplication;
  let supervisorNocToken: string;
  let supervisorNocUser: any;
  let agentNocToken: string;
  let agentNocUser: any;
  let billingDeptId: string;
  let nocDeptId: string;
  let billingTicketId: string;
  let billingAgentUser: any;

  jest.setTimeout(60000);

  beforeAll(async () => {
    const { app: testApp, flushRedis } = await createTestApp();
    await flushRedis();
    app = testApp;

    const drizzle = app.get(DrizzleProvider);
    const allUsers = await drizzle.db.select().from(users);
    const allDepts = await drizzle.db.select().from(departments);

    supervisorNocUser = allUsers.find((u) => u.email === 'supervisor-noc@telecom.local');
    agentNocUser = allUsers.find((u) => u.email === 'noc1@telecom.local');
    billingAgentUser = allUsers.find((u) => u.email === 'billing1@telecom.local');

    const nocDept = allDepts.find((d) => d.name === 'NOC');
    const billingDept = allDepts.find((d) => d.name === 'Billing');

    nocDeptId = nocDept ? nocDept.id : '';
    billingDeptId = billingDept ? billingDept.id : '';

    if (!supervisorNocUser || !agentNocUser || !billingAgentUser || !billingDeptId) {
      throw new Error('Utilisateurs ou departements requis non trouves.');
    }

    // Login Supervisor NOC
    const supLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: supervisorNocUser.email, password: 'Super@1234' });
    supervisorNocToken = supLogin.body.data.accessToken;

    // Login Agent NOC
    const agentLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: agentNocUser.email, password: 'Agent@1234' });
    agentNocToken = agentLogin.body.data.accessToken;

    // Trouver ou créer un ticket Billing pour les tests d'assignation
    const billingTickets = await drizzle.db.select().from(tickets).where(eq(tickets.assignedTeamId, billingDeptId));
    if (billingTickets.length > 0) {
      billingTicketId = billingTickets[0].id;
    } else {
      const { categories } = await import('../../src/database/schemas');
      const billingCats = await drizzle.db.select().from(categories).limit(5);
      // Trouver une catégorie qui n'est pas NETWORK
      const billingCat = billingCats.find((c) => c.name !== 'NETWORK') || billingCats[0];

      const resCreate = await request(app.getHttpServer())
        .post('/api/v1/tickets')
        .set('Authorization', `Bearer ${supervisorNocToken}`)
        .send({
          title: 'Billing incident test',
          description: 'Detail de test',
          priority: 'MEDIUM',
          severity: 'S3',
          categoryId: billingCat.id,
          customerAccountNumber: 'ACC-BILLING-TEST',
          departmentId: billingDeptId,
          assignedTeamId: billingDeptId,
        })
        .expect(201);

      billingTicketId = resCreate.body.data.id;
    }
  });

  afterAll(async () => {
    await app.close();
  }, 60000);

  describe('Isolation de la liste des utilisateurs (GET /users)', () => {
    it('un superviseur NOC ne doit voir que les utilisateurs appartenant au NOC', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${supervisorNocToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.data).toBeDefined();

      // Tous les utilisateurs retournés doivent appartenir au NOC
      for (const u of res.body.data.data) {
        expect(u.departmentId).toBe(nocDeptId);
      }
    });
  });

  describe('Isolation de la mise a jour des utilisateurs (PATCH /users/:id)', () => {
    it('un superviseur NOC ne peut pas modifier un utilisateur du departement Billing', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/users/${billingAgentUser.id}`)
        .set('Authorization', `Bearer ${supervisorNocToken}`)
        .send({ firstName: 'NouveauPrenom' })
        .expect(403);
    });

    it('un superviseur NOC ne peut pas deplacer son agent NOC vers le departement Billing', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/users/${agentNocUser.id}`)
        .set('Authorization', `Bearer ${supervisorNocToken}`)
        .send({ departmentId: billingDeptId })
        .expect(403);
    });

    it('un superviseur NOC ne peut pas promouvoir son agent NOC en administrateur', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/users/${agentNocUser.id}`)
        .set('Authorization', `Bearer ${supervisorNocToken}`)
        .send({ role: 'ADMINISTRATOR' })
        .expect(403);
    });
  });

  describe('Isolation du Dashboard (GET /dashboard)', () => {
    it('un superviseur NOC ne peut pas acceder a la performance de tous les departements', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/dashboard/departments')
        .set('Authorization', `Bearer ${supervisorNocToken}`)
        .expect(403);
    });

    it('un superviseur NOC ne peut pas requerir les stats d un autre departement', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/dashboard/workload?departmentId=${billingDeptId}`)
        .set('Authorization', `Bearer ${supervisorNocToken}`)
        .expect(403);
    });
  });

  describe('Isolation de l auto-assignation manuelle (POST /tickets/:id/assign)', () => {
    it('un agent NOC ne doit pas pouvoir s auto-assigner un ticket Billing', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/tickets/${billingTicketId}/assign`)
        .set('Authorization', `Bearer ${agentNocToken}`)
        .send({ userId: agentNocUser.id, reason: 'Tentative de vol de ticket' })
        .expect(403);
    });
  });
});
