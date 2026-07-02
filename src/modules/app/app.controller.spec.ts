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

    it('doit retourner le bon chemin docs', () => {
      const result = controller.getApiInfo();

      expect(result.docs).toBe('/api/docs');
    });

    it('doit retourner le bon chemin health', () => {
      const result = controller.getApiInfo();

      expect(result.health).toBe('/api/v1/health');
    });

    it('doit retourner le chemin metrics avec mention Prometheus', () => {
      const result = controller.getApiInfo();

      expect(result.metrics).toContain('Prometheus');
    });
  });
});
