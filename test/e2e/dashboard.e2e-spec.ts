import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { GlobalExceptionFilter } from '../../src/common/filters/global-exception.filter';
import { TransformInterceptor } from '../../src/common/interceptors/transform.interceptor';
import { DrizzleProvider } from '../../src/database/drizzle.provider';
import { users } from '../../src/database/schemas';

describe('Dashboard — E2E', () => {
  let app: INestApplication;
  let adminToken: string;
  let agentToken: string;

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
    const admin = allUsers.find((u) => u.role === 'ADMINISTRATOR');
    const csAgent = allUsers.find((u) => u.role === 'CUSTOMER_SERVICE_AGENT');

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

  describe('Vérification des 7 endpoints dashboard', () => {
    const endpoints = [
      'overview',
      'tickets-by-status',
      'tickets-by-priority',
      'departments',
      'sla-compliance',
      'workload',
      'resolution-time',
    ];

    for (const ep of endpoints) {
      it(`GET /dashboard/${ep} — doit réussir pour l admin -> 200`, async () => {
        const res = await request(app.getHttpServer())
          .get(`/api/v1/dashboard/${ep}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(res.body.success).toBe(true);
        expect(res.body.data).toBeDefined();
      });

      it(`GET /dashboard/${ep} — doit refuser à un simple agent -> 403`, async () => {
        await request(app.getHttpServer())
          .get(`/api/v1/dashboard/${ep}`)
          .set('Authorization', `Bearer ${agentToken}`)
          .expect(403);
      });
    }
  });
});
