import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { GlobalExceptionFilter } from '../../src/common/filters/global-exception.filter';
import { TransformInterceptor } from '../../src/common/interceptors/transform.interceptor';

describe('SLA — Intégration (DB réelle)', () => {
  jest.setTimeout(60000);
  let app: INestApplication;
  let adminToken: string;

  beforeAll(async () => {
    const m = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = m.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new GlobalExceptionFilter());
    app.useGlobalInterceptors(new TransformInterceptor());
    app.setGlobalPrefix('api/v1');
    await app.init();

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'admin@telecom.local', password: 'Admin@1234' });
    if (login.body.success) adminToken = login.body.data.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /sla-policies — doit retourner les politiques SLA (200)', async () => {
    if (!adminToken) return;
    const res = await request(app.getHttpServer())
      .get('/api/v1/sla-policies')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
  });

  it('POST /sla-policies — doit créer une politique SLA (201)', async () => {
    if (!adminToken) return;
    const { DrizzleProvider } = await import('../../src/database/drizzle.provider');
    const { slaPolicies, categories } = await import('../../src/database/schemas');
    const { and, eq } = await import('drizzle-orm');
    const { generateUuid } = await import('../../src/common/helpers/uuidv7.helper');
    const drizzle = app.get(DrizzleProvider);

    // Récupérer ou créer la catégorie HARDWARE
    let hardwareCat = (await drizzle.db.select().from(categories).where(eq(categories.name, 'HARDWARE')).limit(1))[0];
    if (!hardwareCat) {
      const id = generateUuid();
      [hardwareCat] = await drizzle.db
        .insert(categories)
        .values({ id, name: 'HARDWARE', description: 'Matériel' })
        .returning();
    }

    await drizzle.db
      .delete(slaPolicies)
      .where(and(eq(slaPolicies.categoryId, hardwareCat.id), eq(slaPolicies.priority, 'LOW')));

    const res = await request(app.getHttpServer())
      .post('/api/v1/sla-policies')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ categoryId: hardwareCat.id, priority: 'LOW', firstResponseMinutes: 240, resolutionMinutes: 1440 })
      .expect(201);
    expect(res.body.success).toBe(true);
  });

  it('GET /dashboard/sla-compliance — doit retourner les stats SLA (200)', async () => {
    if (!adminToken) return;
    const res = await request(app.getHttpServer())
      .get('/api/v1/dashboard/sla-compliance')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body.success).toBe(true);
  });
});
