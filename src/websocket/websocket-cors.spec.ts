/**
 * ============================================================================
 * FICHIER : src/websocket/websocket-cors.spec.ts
 * RÔLE : Suite de tests unitaires pour le composant websocket-cors.
 * EXPLICATION :
 * Ce fichier contient les tests automatisés validant le comportement et l'intégrité de websocket-cors.
 * 1. Vérifie le fonctionnement nominal et les cas d'erreur.
 * 2. Garantit qu'aucune régression n'est introduite lors des évolutions du code.
 * ============================================================================
 */

import { websocketCorsOrigin } from './websocket-cors';

describe('websocketCorsOrigin', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, NODE_ENV: 'test', CORS_ORIGIN: 'https://app.example.test' };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  /** Test : accepte une origine explicitement configuree */

  it('accepte une origine explicitement configuree', () => {
    const callback = jest.fn();
    websocketCorsOrigin('https://app.example.test', callback);
    expect(callback).toHaveBeenCalledWith(null, true);
  });

  /** Test : rejette une origine hostile */

  it('rejette une origine hostile', () => {
    const callback = jest.fn();
    websocketCorsOrigin('https://evil.example', callback);
    expect(callback.mock.calls[0]?.[0]).toBeInstanceOf(Error);
  });

  /** Test : rejette une connexion sans origine */

  it('rejette une connexion sans origine', () => {
    const callback = jest.fn();
    websocketCorsOrigin(undefined, callback);
    expect(callback.mock.calls[0]?.[0]).toBeInstanceOf(Error);
  });

  /** Test : refuse de demarrer implicitement avec localhost en production */

  it('refuse de demarrer implicitement avec localhost en production', () => {
    delete process.env['CORS_ORIGIN'];
    process.env['NODE_ENV'] = 'production';
    const callback = jest.fn();
    websocketCorsOrigin('https://app.example.test', callback);
    expect(callback.mock.calls[0]?.[0]).toBeInstanceOf(Error);
  });
});
