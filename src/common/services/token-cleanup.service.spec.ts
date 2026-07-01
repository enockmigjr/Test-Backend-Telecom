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
    it('doit supprimer les tokens expirés et révoqués', async () => {
      mockDeleteChain.returning.mockResolvedValueOnce([{ id: 't1' }, { id: 't2' }]); // expirés
      mockDeleteChain.returning.mockResolvedValueOnce([{ id: 't3' }]); // révoqués

      const result = await service.cleanNow();

      expect(result.expired).toBe(2);
      expect(result.revoked).toBe(1);
    });

    it('doit retourner zéro quand aucun token à nettoyer', async () => {
      mockDeleteChain.returning.mockResolvedValueOnce([]);
      mockDeleteChain.returning.mockResolvedValueOnce([]);

      const result = await service.cleanNow();

      expect(result.expired).toBe(0);
      expect(result.revoked).toBe(0);
    });

    it('doit gérer les erreurs DB', async () => {
      mockDeleteChain.returning.mockRejectedValueOnce(new Error('DB error'));
      mockDeleteChain.returning.mockResolvedValueOnce([]);

      await expect(service.cleanNow()).rejects.toThrow('DB error');
    });
  });

  describe('cleanExpiredTokens (cron)', () => {
    it('ne doit pas planter si la DB est inaccessible', async () => {
      mockDeleteChain.returning.mockRejectedValueOnce(new Error('Connection refused'));
      // Ne doit pas throw — le cron catch les erreurs
      await expect(service.cleanExpiredTokens()).resolves.toBeUndefined();
    });

    it('doit logger les résultats', async () => {
      mockDeleteChain.returning.mockResolvedValueOnce([{ id: 't1' }]);
      mockDeleteChain.returning.mockResolvedValueOnce([]);

      const logSpy = jest.spyOn(service['logger'], 'log');
      await service.cleanExpiredTokens();
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('1 expirés'));
    });
  });
});
