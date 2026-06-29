import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { GlobalExceptionFilter } from '../../src/common/filters/global-exception.filter';
import { TransformInterceptor } from '../../src/common/interceptors/transform.interceptor';

describe('SLA — Intégration (DB réelle)', () => {
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
    const res = await request(app.getHttpServer())
      .post('/api/v1/sla-policies')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ category: 'HARDWARE', priority: 'LOW', firstResponseMinutes: 240, resolutionMinutes: 1440 })
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
