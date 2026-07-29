/**
 * ============================================================================
 * FICHIER : src/config/jwt.config.spec.ts
 * RÔLE : Suite de tests unitaires pour le composant jwt.config.
 * EXPLICATION :
 * Ce fichier contient les tests automatisés validant le comportement et l'intégrité de jwt.config.
 * 1. Vérifie le fonctionnement nominal et les cas d'erreur.
 * 2. Garantit qu'aucune régression n'est introduite lors des évolutions du code.
 * ============================================================================
 */

import { JwtConfigService } from './jwt.config';

describe('JwtConfigService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, NODE_ENV: 'test' };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  /** Test : convertit les expirations configurees en secondes */

  it('convertit les expirations configurees en secondes', () => {
    process.env['JWT_ACCESS_EXPIRATION'] = '20m';
    process.env['JWT_REFRESH_EXPIRATION'] = '2d';
    const config = new JwtConfigService();
    expect(config.accessExpirationSeconds).toBe(1200);
    expect(config.refreshExpirationSeconds).toBe(172800);
  });

  /** Test : interdit le secret de developpement implicite en production */

  it('interdit le secret de developpement implicite en production', () => {
    process.env['NODE_ENV'] = 'production';
    delete process.env['JWT_ACCESS_SECRET'];
    expect(() => new JwtConfigService().accessSecret).toThrow('JWT_ACCESS_SECRET');
  });

  /** Test : interdit la valeur exemple en production */

  it('interdit la valeur exemple en production', () => {
    process.env['NODE_ENV'] = 'production';
    process.env['JWT_ACCESS_SECRET'] = 'change-me-access-secret-min-32-chars';
    expect(() => new JwtConfigService().accessSecret).toThrow('JWT_ACCESS_SECRET');
  });
});
