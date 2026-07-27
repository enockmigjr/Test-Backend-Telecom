import { normalizePagination } from './normalized-pagination.helper';

describe('normalizePagination', () => {
  it('convertit les paramètres de requête reçus sous forme de chaînes', () => {
    expect(normalizePagination('2', '50')).toEqual({ page: 2, limit: 50 });
  });

  it('borne les valeurs invalides aux limites autorisées', () => {
    expect(normalizePagination('-4', '500')).toEqual({ page: 1, limit: 100 });
    expect(normalizePagination('invalide', 'invalide')).toEqual({ page: 1, limit: 20 });
  });
});
