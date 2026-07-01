import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { GlobalExceptionFilter } from '../../src/common/filters/global-exception.filter';
import { TransformInterceptor } from '../../src/common/interceptors/transform.interceptor';
import { DrizzleProvider } from '@database/drizzle.provider';
import { departments, users } from '@database/schemas';
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

  beforeAll(async () => {
    process.env.LOG_LEVEL = 'error';
    process.env.THROTTLE_LIMIT = '10000';
    process.env.THROTTLE_AUTH_LIMIT = '10000';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    app.useGlobalFilters(new GlobalExceptionFilter());
    app.useGlobalInterceptors(new TransformInterceptor());

    await app.init();

    // Récupérer dynamiquement les données du seed
    const drizzle = app.get(DrizzleProvider);
    const [dept] = await drizzle.db.select().from(departments).limit(1);
    departmentId = dept?.id;

    const [agent] = await drizzle.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, 'agent@telecom.local'))
      .limit(1);
    agentUserId = agent?.id;

    // Authentification des differents roles
    const adminLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'admin@telecom.local', password: 'Admin@1234' });
    adminToken = adminLogin.body.data?.accessToken || '';

    const agentLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'agent@telecom.local', password: 'Agent@1234' });
    agentToken = agentLogin.body.data?.accessToken || '';

    const supervisorLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'supervisor@telecom.local', password: 'Super@1234' });
    supervisorToken = supervisorLogin.body.data?.accessToken || '';
  });

  afterAll(async () => {
    await app.close();
  });

  // =========================================================================
  // Creer un utilisateur (POST /api/v1/users) — Admin uniquement
  // =========================================================================
  describe("POST /api/v1/users — Creation d'utilisateur", () => {
    const getNewUserPayload = () => ({
      email: 'nouvel-agent@telecom.local',
      password: 'NewAgent@1234',
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
    const fakeTicketId = '00000000-0000-0000-0000-000000000001';

    it('ADMINISTRATOR peut assigner un ticket → 200 ou 404 si inexistant', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/tickets/${fakeTicketId}/assign`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ userId: agentUserId });

      // Le ticket n'existe pas, donc 404 — mais l'acces est autorise
      expect([200, 404]).toContain(res.status);
    });

    it('TECHNICAL_SUPPORT_ENGINEER ne peut PAS assigner un ticket → 403', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/tickets/${fakeTicketId}/assign`)
        .set('Authorization', `Bearer ${agentToken}`)
        .send({ userId: agentUserId })
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  // =========================================================================
  // Cloturer un ticket (POST /api/v1/tickets/:id/close) — Admin et Supervisor
  // =========================================================================
  describe('POST /api/v1/tickets/:id/close — Cloture de ticket', () => {
    const fakeTicketId = '00000000-0000-0000-0000-000000000002';

    it('ADMINISTRATOR peut cloturer un ticket → 200 ou 404 si inexistant', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/tickets/${fakeTicketId}/close`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect([200, 404]).toContain(res.status);
    });

    it('TECHNICAL_SUPPORT_ENGINEER ne peut PAS cloturer un ticket → 403', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/tickets/${fakeTicketId}/close`)
        .set('Authorization', `Bearer ${agentToken}`)
        .expect(403);
    });
  });

  // =========================================================================
  // Reouvrir un ticket (POST /api/v1/tickets/:id/reopen) — Admin et Supervisor
  // =========================================================================
  describe('POST /api/v1/tickets/:id/reopen — Reouverture de ticket', () => {
    const fakeTicketId = '00000000-0000-0000-0000-000000000003';

    it('ADMINISTRATOR peut reouvrir un ticket → 200 ou 404 si inexistant', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/tickets/${fakeTicketId}/reopen`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect([200, 404]).toContain(res.status);
    });

    it('TECHNICAL_SUPPORT_ENGINEER ne peut PAS reouvrir un ticket → 403', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/tickets/${fakeTicketId}/reopen`)
        .set('Authorization', `Bearer ${agentToken}`)
        .expect(403);
    });
  });
});
