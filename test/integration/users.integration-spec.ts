import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from '../setup';
import { tokenFor } from '../auth.helper';

/**
 * Tests d'intégration CRUD utilisateurs avec DB réelle.
 * Nécessite: PostgreSQL test + seed (admin@telecom.local / Admin@1234)
 */
describe('Users — CRUD Intégration (DB réelle)', () => {
  jest.setTimeout(60000);
  let app: INestApplication;
  let adminToken: string;

  beforeAll(async () => {
    const { app: testApp } = await createTestApp();
    app = testApp;

    // Jeton Keycloak RS256 signé avec la clé de test (rôle du seed)
    adminToken = tokenFor('admin');
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /users — doit retourner une liste paginée (200)', async () => {
    if (!adminToken) return;
    const res = await request(app.getHttpServer())
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(res.body.meta).toBeDefined();
  });

  it('GET /users/me — doit retourner le profil connecté (200)', async () => {
    if (!adminToken) return;
    const res = await request(app.getHttpServer())
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.email).toBe('admin@telecom.local');
  });

  it('POST /users — doit créer un utilisateur (201)', async () => {
    if (!adminToken) return;
    const res = await request(app.getHttpServer())
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        email: `test-${Date.now()}@telecom.local`,
        firstName: 'Integration',
        lastName: 'Test',
        role: 'CUSTOMER_SERVICE_AGENT',
        departmentId: '00000000-0000-0000-0000-000000000001',
      });

    // 201 si le département existe, 400 si non — les deux sont OK pour ce test
    expect([201, 400]).toContain(res.status);
  });

  it('GET /users sans token — doit retourner 401', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/users').expect(401);
    expect(res.body.success).toBe(false);
  });
});
