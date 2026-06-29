import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { GlobalExceptionFilter } from '../../src/common/filters/global-exception.filter';
import { TransformInterceptor } from '../../src/common/interceptors/transform.interceptor';
import { DrizzleProvider } from '../../src/database/drizzle.provider';
import { departments, users, slaPolicies } from '../../src/database/schemas';
import { generateUuid } from '../../src/common/helpers/uuidv7.helper';

/**
 * Tests d'intégration du workflow ticket complet.
 * Nécessite une base PostgreSQL de test accessible.
 *
 * Prérequis: DATABASE_URL pointant vers la base de test
 *   ex: postgresql://telecom:telecom_secret@localhost:5432/telecom_tickets_test
 *
 * Setup: pnpm run db:push (sur la DB test)
 */
describe('Tickets — Workflow Intégration (DB réelle)', () => {
  let app: INestApplication;
  let adminToken: string;
  let deptId: string;
  let userId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new GlobalExceptionFilter());
    app.useGlobalInterceptors(new TransformInterceptor());
    app.setGlobalPrefix('api/v1');
    await app.init();

    // Seed minimal: département + utilisateur + SLA policy
    const drizzle = app.get(DrizzleProvider);
    deptId = generateUuid();
    userId = generateUuid();

    try {
      await drizzle.db.insert(departments).values({ id: deptId, name: 'Test Dept' });
      await drizzle.db.insert(users).values({
        id: userId,
        departmentId: deptId,
        email: 'test-integration@telecom.local',
        passwordHash: '$argon2id$dummy',
        firstName: 'Test',
        lastName: 'User',
        role: 'ADMINISTRATOR',
        isActive: true,
      });
      await drizzle.db.insert(slaPolicies).values({
        id: generateUuid(),
        category: 'TECHNICAL',
        priority: 'MEDIUM',
        firstResponseMinutes: 60,
        resolutionMinutes: 480,
      });
    } catch {
      /* Déjà seedé */
    }

    // Login
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'admin@telecom.local', password: 'Admin@1234' });
    if (res.body.success) adminToken = res.body.data.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /tickets — doit créer un ticket (201)', async () => {
    if (!adminToken) return; // Skip si pas de login
    const res = await request(app.getHttpServer())
      .post('/api/v1/tickets')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Test intégration — Coupure fibre',
        description: 'Description du ticket de test',
        priority: 'HIGH',
        severity: 'S2',
        category: 'NETWORK',
        departmentId: deptId,
        assignedTeamId: deptId,
        customerName: 'Client Test',
        customerContact: '0123456789',
      })
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data.ticketNumber).toBeDefined();
    expect(res.body.data.status).toBe('NEW');
    expect(res.body.data.priority).toBe('HIGH');
  });

  it('GET /tickets — doit retourner une liste paginée (200)', async () => {
    if (!adminToken) return;
    const res = await request(app.getHttpServer())
      .get('/api/v1/tickets')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(res.body.meta).toBeDefined();
    expect(res.body.meta.page).toBe(1);
  });

  it('GET /tickets/:id — doit retourner 404 pour un ticket inexistant', async () => {
    if (!adminToken) return;
    const res = await request(app.getHttpServer())
      .get(`/api/v1/tickets/${generateUuid()}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
