/**
 * ============================================================================
 * FICHIER : src/common/decorators/auth-rate-limited.decorator.spec.ts
 * RÔLE : Suite de tests unitaires pour le composant auth-rate-limited.decorator.
 * EXPLICATION :
 * Ce fichier contient les tests automatisés validant le comportement et l'intégrité de auth-rate-limited.decorator.
 * 1. Vérifie le fonctionnement nominal et les cas d'erreur.
 * 2. Garantit qu'aucune régression n'est introduite lors des évolutions du code.
 * ============================================================================
 */

import { AUTH_RATE_LIMITED_KEY, isAuthRateLimited } from './auth-rate-limited.decorator';

describe('isAuthRateLimited', () => {
  /** Test : ne cible que les handlers explicitement marqués */
  it('ne cible que les handlers explicitement marqués', () => {
    const login = () => undefined;
    const profile = () => undefined;
    Reflect.defineMetadata(AUTH_RATE_LIMITED_KEY, true, login);

    expect(isAuthRateLimited(login)).toBe(true);
    expect(isAuthRateLimited(profile)).toBe(false);
  });
});
