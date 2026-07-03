import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { GlobalExceptionFilter } from '../../src/common/filters/global-exception.filter';
import { TransformInterceptor } from '../../src/common/interceptors/transform.interceptor';
import { DrizzleProvider } from '../../src/database/drizzle.provider';
import { users } from '../../src/database/schemas';

describe('Departments — E2E', () => {
  let app: INestApplication;
  let adminToken: string;
  let agentToken: string;
  let createdDeptId: string;

  jest.setTimeout(60000);

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new GlobalExceptionFilter());
    app.useGlobalInterceptors(new TransformInterceptor());
    app.setGlobalPrefix('api/v1');
    await app.init();

    // Récupérer des jetons
    const drizzle = app.get(DrizzleProvider);
    const allUsers = await drizzle.db.select().from(users);
    const admin = allUsers.find((u) => u.email === 'admin@telecom.local');
    const csAgent = allUsers.find((u) => u.email === 'agent-cc1@telecom.local');

    if (!admin || !csAgent) {
      throw new Error('Utilisateurs requis du seed non trouvés.');
    }

    const adminLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: admin.email, password: 'Admin@1234' });
    adminToken = adminLogin.body.data.accessToken;

    const agentLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: csAgent.email, password: 'Agent@1234' });
    agentToken = agentLogin.body.data.accessToken;
  });

  afterAll(async () => {
    await app.close();
  }, 60000);

  describe('GET /api/v1/departments', () => {
    it('doit refuser d acces sans authentification -> 401', async () => {
      await request(app.getHttpServer()).get('/api/v1/departments').expect(401);
    });

    it('doit retourner la liste des departements pour un utilisateur authentifie -> 200', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/departments')
        .set('Authorization', `Bearer ${agentToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
    });
  });

  describe('POST /api/v1/departments', () => {
    it('doit empecher un agent de creer un departement -> 403', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/departments')
        .set('Authorization', `Bearer ${agentToken}`)
        .send({ name: 'Nouveau Dept', description: 'Description' })
        .expect(403);
    });

    it('doit autoriser l admin a creer un departement -> 201', async () => {
      const deptName = `Fibre Ops ${Date.now()}`;
      const res = await request(app.getHttpServer())
        .post('/api/v1/departments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: deptName, description: 'Interventions fibre optique' })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.name).toBe(deptName);
      createdDeptId = res.body.data.id;
    });

    it('doit rejeter la creation avec un nom deja existant -> 409', async () => {
      const existingDeptName = 'NOC'; // Seeded
      const res = await request(app.getHttpServer())
        .post('/api/v1/departments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: existingDeptName, description: 'Test duplicate' })
        .expect(409);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('CONFLICT');
    });
  });

  describe('GET /api/v1/departments/:id', () => {
    it('doit retourner le detail d un departement existant -> 200', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/departments/${createdDeptId}`)
        .set('Authorization', `Bearer ${agentToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(createdDeptId);
    });

    it('doit retourner 404 pour un id inexistant', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/departments/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${agentToken}`)
        .expect(404);
    });
  });

  describe('PATCH /api/v1/departments/:id', () => {
    it('doit autoriser l admin a modifier le departement -> 200', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/departments/${createdDeptId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ description: 'Description modifiee' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.description).toBe('Description modifiee');
    });
  });

  describe('DELETE /api/v1/departments/:id', () => {
    it('doit autoriser l admin a supprimer (soft-delete) le departement -> 204', async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/departments/${createdDeptId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204);

      // Verifier que le GET renvoie 404 apres suppression
      await request(app.getHttpServer())
        .get(`/api/v1/departments/${createdDeptId}`)
        .set('Authorization', `Bearer ${agentToken}`)
        .expect(404);
    });
  });
});
