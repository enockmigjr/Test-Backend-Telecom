/* eslint-disable @typescript-eslint/no-explicit-any */
import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';

describe('AppController', () => {
  let controller: AppController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
    }).compile();

    controller = module.get<AppController>(AppController);
  });

  // =========================================================================
  // GET / (api info)
  // =========================================================================
  describe('GET / — API info', () => {
    it('doit retourner les informations de base de l API', () => {
      const result = controller.getApiInfo();

      expect(result).toEqual({
        name: 'Telecom Ticket Management API',
        version: '1.0.0',
        status: 'operational',
        docs: '/api/docs',
        health: '/api/v1/health',
        metrics: '/api/v1/metrics (Prometheus OpenMetrics)',
      });
    });

    it('doit retourner un objet avec les 6 proprietes requises', () => {
      const result = controller.getApiInfo();

      expect(result).toHaveProperty('name');
      expect(result).toHaveProperty('version');
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('docs');
      expect(result).toHaveProperty('health');
      expect(result).toHaveProperty('metrics');
    });

    it('doit retourner status operational', () => {
      const result = controller.getApiInfo();

      expect(result.status).toBe('operational');
    });

    it('doit retourner la version 1.0.0', () => {
      const result = controller.getApiInfo();

      expect(result.version).toBe('1.0.0');
    });
  });

  // =========================================================================
  // GET /health
  // =========================================================================
  describe('GET /health — Health check', () => {
    it('doit retourner un status ok', () => {
      const result = controller.health();

      expect(result.status).toBe('ok');
    });

    it('doit contenir un timestamp ISO valide', () => {
      const result = controller.health();

      expect(result.timestamp).toBeDefined();
      expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp);
    });

    it('doit contenir uptime comme nombre positif', () => {
      const result = controller.health();

      expect(result.uptime).toBeGreaterThanOrEqual(0);
    });

    it('doit contenir memory usage avec rss, heapTotal, heapUsed', () => {
      const result = controller.health();

      expect(result.memory).toHaveProperty('rss');
      expect(result.memory).toHaveProperty('heapTotal');
      expect(result.memory).toHaveProperty('heapUsed');
      expect(typeof result.memory.rss).toBe('number');
      expect(typeof result.memory.heapTotal).toBe('number');
      expect(typeof result.memory.heapUsed).toBe('number');
    });

    it('doit retourner les 4 proprietes du health check', () => {
      const result = controller.health();

      expect(Object.keys(result)).toEqual(['status', 'timestamp', 'uptime', 'memory']);
    });
  });

  // =========================================================================
  // GET /test-swagger
  // =========================================================================
  describe('GET /test-swagger — Route de test', () => {
    it('doit retourner un message de confirmation', () => {
      const result = controller.testSwagger();

      expect(result).toHaveProperty('message');
    });

    it('doit contenir le texte attendu', () => {
      const result = controller.testSwagger();

      expect(result.message).toContain('Si tu vois cette route dans Swagger');
    });
  });
});
