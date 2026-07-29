/**
 * ============================================================================
 * FICHIER : src/common/services/token-cleanup.service.spec.ts
 * RÔLE : Suite de tests unitaires pour le composant token-cleanup.service.
 * EXPLICATION :
 * Ce fichier contient les tests automatisés validant le comportement et l'intégrité de token-cleanup.service.
 * 1. Vérifie le fonctionnement nominal et les cas d'erreur.
 * 2. Garantit qu'aucune régression n'est introduite lors des évolutions du code.
 * ============================================================================
 */

import { Test, TestingModule } from '@nestjs/testing';
import { TokenCleanupService } from './token-cleanup.service';
import { DrizzleProvider } from '../../database/drizzle.provider';
import { mock } from 'jest-mock-extended';

describe('TokenCleanupService', () => {
  let service: TokenCleanupService;
  let drizzle: ReturnType<typeof mock<DrizzleProvider>>;

  const mockDeleteChain = {
    where: jest.fn().mockReturnThis(),
    returning: jest.fn(),
  };

  beforeEach(async () => {
    drizzle = mock<DrizzleProvider>();
    Object.defineProperty(drizzle, 'db', {
      get: () => ({ delete: jest.fn().mockReturnValue(mockDeleteChain) }),
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [TokenCleanupService, { provide: DrizzleProvider, useValue: drizzle }],
    }).compile();

    service = module.get<TokenCleanupService>(TokenCleanupService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('cleanNow', () => {
    /** Test : doit supprimer les tokens expirés et révoqués */
    it('doit supprimer les tokens expirés et révoqués', async () => {
      mockDeleteChain.returning.mockResolvedValueOnce([{ id: 't1' }, { id: 't2' }]); // expirés
      mockDeleteChain.returning.mockResolvedValueOnce([{ id: 't3' }]); // révoqués

      const result = await service.cleanNow();

      expect(result.expired).toBe(2);
      expect(result.revoked).toBe(1);
    });

    /** Test : doit retourner zéro quand aucun token à nettoyer */

    it('doit retourner zéro quand aucun token à nettoyer', async () => {
      mockDeleteChain.returning.mockResolvedValueOnce([]);
      mockDeleteChain.returning.mockResolvedValueOnce([]);

      const result = await service.cleanNow();

      expect(result.expired).toBe(0);
      expect(result.revoked).toBe(0);
    });

    /** Test : doit gérer les erreurs DB */

    it('doit gérer les erreurs DB', async () => {
      mockDeleteChain.returning.mockRejectedValueOnce(new Error('DB error'));
      mockDeleteChain.returning.mockResolvedValueOnce([]);

      await expect(service.cleanNow()).rejects.toThrow('DB error');
    });
  });

  describe('cleanExpiredTokens (cron)', () => {
    /** Test : ne doit pas planter si la DB est inaccessible */
    it('ne doit pas planter si la DB est inaccessible', async () => {
      mockDeleteChain.returning.mockRejectedValueOnce(new Error('Connection refused'));
      // Ne doit pas throw — le cron catch les erreurs
      await expect(service.cleanExpiredTokens()).resolves.toBeUndefined();
    });

    /** Test : doit logger les résultats */

    it('doit logger les résultats', async () => {
      mockDeleteChain.returning.mockResolvedValueOnce([{ id: 't1' }]);
      mockDeleteChain.returning.mockResolvedValueOnce([]);

      const logSpy = jest.spyOn(service['logger'], 'log');
      await service.cleanExpiredTokens();
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('1 expirés'));
    });
  });
});
