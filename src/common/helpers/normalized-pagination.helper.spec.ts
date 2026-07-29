/**
 * ============================================================================
 * FICHIER : src/common/helpers/normalized-pagination.helper.spec.ts
 * RÔLE : Suite de tests unitaires pour le composant normalized-pagination.helper.
 * EXPLICATION :
 * Ce fichier contient les tests automatisés validant le comportement et l'intégrité de normalized-pagination.helper.
 * 1. Vérifie le fonctionnement nominal et les cas d'erreur.
 * 2. Garantit qu'aucune régression n'est introduite lors des évolutions du code.
 * ============================================================================
 */

import { normalizePagination } from './normalized-pagination.helper';

describe('normalizePagination', () => {
  /** Test : convertit les paramètres de requête reçus sous forme de chaînes */
  it('convertit les paramètres de requête reçus sous forme de chaînes', () => {
    expect(normalizePagination('2', '50')).toEqual({ page: 2, limit: 50 });
  });

  /** Test : borne les valeurs invalides aux limites autorisées */

  it('borne les valeurs invalides aux limites autorisées', () => {
    expect(normalizePagination('-4', '500')).toEqual({ page: 1, limit: 100 });
    expect(normalizePagination('invalide', 'invalide')).toEqual({ page: 1, limit: 20 });
  });
});
