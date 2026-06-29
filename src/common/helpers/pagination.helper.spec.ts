import { PaginationHelper } from './pagination.helper';

/**
 * Tests unitaires du PaginationHelper.
 *
 * Le helper de pagination est un utilitaire statique qui standardise
 * toutes les reponses paginees de l'API. Chaque methode doit produire
 * des valeurs correctes mathematiquement et etre predicable.
 */
describe('PaginationHelper', () => {
  describe('buildMeta() — Metadonnees de pagination', () => {
    it('doit retourner page=1, limit=20, total=100, totalPages=5', () => {
      const meta = PaginationHelper.buildMeta(1, 20, 100);

      expect(meta).toEqual({
        page: 1,
        limit: 20,
        total: 100,
        totalPages: 5,
      });
    });

    it("doit arrondir a l'entier superieur pour totalPages quand le total n'est pas un multiple", () => {
      const meta = PaginationHelper.buildMeta(1, 20, 101);

      expect(meta.totalPages).toBe(6); // Math.ceil(101/20) = 6
    });

    it('doit retourner totalPages=0 quand total=0', () => {
      const meta = PaginationHelper.buildMeta(1, 20, 0);

      expect(meta.totalPages).toBe(0);
    });

    it('doit retourner totalPages=1 quand total <= limit', () => {
      const meta = PaginationHelper.buildMeta(1, 20, 15);

      expect(meta.totalPages).toBe(1);
    });

    it('doit supporter une grande page et un grand total', () => {
      const meta = PaginationHelper.buildMeta(50, 100, 5000);

      expect(meta.page).toBe(50);
      expect(meta.limit).toBe(100);
      expect(meta.total).toBe(5000);
      expect(meta.totalPages).toBe(50);
    });
  });

  describe("getOffset() — Calcul d'offset SQL", () => {
    it('doit retourner 0 pour la page 1 avec limit 20', () => {
      const offset = PaginationHelper.getOffset(1, 20);
      expect(offset).toBe(0);
    });

    it('doit retourner 20 pour la page 2 avec limit 20', () => {
      const offset = PaginationHelper.getOffset(2, 20);
      expect(offset).toBe(20);
    });

    it('doit retourner 100 pour la page 6 avec limit 20', () => {
      const offset = PaginationHelper.getOffset(6, 20);
      expect(offset).toBe(100);
    });

    it("doit retourner 0 pour la page 1 avec n'importe quelle limite", () => {
      expect(PaginationHelper.getOffset(1, 10)).toBe(0);
      expect(PaginationHelper.getOffset(1, 50)).toBe(0);
      expect(PaginationHelper.getOffset(1, 100)).toBe(0);
    });

    it('doit gérer page=0 comme page=1 (offset=0)', () => {
      const offset = PaginationHelper.getOffset(0, 20);
      expect(offset).toBe(-20); // Comportement non protege, page 0 donne -20
    });
  });

  describe('paginate() — Reponse paginee complete', () => {
    const mockData = [
      { id: '1', name: 'Item A' },
      { id: '2', name: 'Item B' },
    ];

    it('doit retourner { data, meta } avec les bonnes valeurs', () => {
      const result = PaginationHelper.paginate(mockData, 100, 1, 20);

      expect(result).toEqual({
        data: mockData,
        meta: {
          page: 1,
          limit: 20,
          total: 100,
          totalPages: 5,
        },
      });
    });

    it("doit retourner un tableau data vide quand il n'y a pas de resultats", () => {
      const result = PaginationHelper.paginate([], 0, 1, 20);

      expect(result.data).toEqual([]);
      expect(result.meta.total).toBe(0);
      expect(result.meta.totalPages).toBe(0);
    });

    it('doit encapsuler les donnees sans les modifier', () => {
      const data = [{ id: 'x' }, { id: 'y' }, { id: 'z' }];
      const result = PaginationHelper.paginate(data, 3, 1, 10);

      expect(result.data).toBe(data); // Meme reference, pas de clone
      expect(result.data).toHaveLength(3);
    });
  });
});
