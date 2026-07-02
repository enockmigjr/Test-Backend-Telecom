import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from '../setup';

describe('Health — E2E', () => {
  let app: INestApplication;

  jest.setTimeout(60000);

  beforeAll(async () => {
    const { app: testApp, flushRedis } = await createTestApp();
    await flushRedis();
    app = testApp;
  });

  afterAll(async () => {
    await app.close();
  }, 60000);

  it('GET /api/v1/health — Liveness (200)', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health').expect(200);

    expect(res.body.data.status).toBe('ok');
    expect(res.body.data.timestamp).toBeDefined();
    expect(res.body.data.uptime).toBeDefined();
  });

  it('GET /api/v1/health/ready — Readiness (200)', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health/ready').expect(200);

    expect(res.body.data.status).toBe('ok');
    expect(res.body.data.checks).toBeDefined();
    expect(res.body.data.checks.postgresql.status).toBe('ok');
    expect(res.body.data.checks.redis.status).toBe('ok');
  });
});
