/**
 * ============================================================================
 * FICHIER : src/modules/app/app.controller.spec.ts
 * RÔLE : Suite de tests unitaires pour le composant app.controller.
 * EXPLICATION :
 * Ce fichier contient les tests automatisés validant le comportement et l'intégrité de app.controller.
 * 1. Vérifie le fonctionnement nominal et les cas d'erreur.
 * 2. Garantit qu'aucune régression n'est introduite lors des évolutions du code.
 * ============================================================================
 */

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
    /** Test : doit retourner les informations de base de l API */
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

    /** Test : doit retourner un objet avec les 6 proprietes requises */

    it('doit retourner un objet avec les 6 proprietes requises', () => {
      const result = controller.getApiInfo();

      expect(result).toHaveProperty('name');
      expect(result).toHaveProperty('version');
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('docs');
      expect(result).toHaveProperty('health');
      expect(result).toHaveProperty('metrics');
    });

    /** Test : doit retourner status operational */

    it('doit retourner status operational', () => {
      const result = controller.getApiInfo();

      expect(result.status).toBe('operational');
    });

    /** Test : doit retourner la version 1.0.0 */

    it('doit retourner la version 1.0.0', () => {
      const result = controller.getApiInfo();

      expect(result.version).toBe('1.0.0');
    });

    /** Test : doit retourner le bon chemin docs */

    it('doit retourner le bon chemin docs', () => {
      const result = controller.getApiInfo();

      expect(result.docs).toBe('/api/docs');
    });

    /** Test : doit retourner le bon chemin health */

    it('doit retourner le bon chemin health', () => {
      const result = controller.getApiInfo();

      expect(result.health).toBe('/api/v1/health');
    });

    /** Test : doit retourner le chemin metrics avec mention Prometheus */

    it('doit retourner le chemin metrics avec mention Prometheus', () => {
      const result = controller.getApiInfo();

      expect(result.metrics).toContain('Prometheus');
    });
  });
});
