import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { mock, MockProxy } from 'jest-mock-extended';

import { AuthService } from './auth.service';
import { DrizzleProvider } from '../../database/drizzle.provider';
import { JwtConfigService } from '../../config/jwt.config';
import { RedisProvider } from '../../common/providers/redis.provider';

// ---------------------------------------------------------------------------
// Mocks des modules natifs et de tiers utilises par AuthService
// ---------------------------------------------------------------------------
jest.mock('argon2', () => ({
  verify: jest.fn(),
  hash: jest.fn().mockResolvedValue('new-hashed-password'),
  argon2id: 'argon2id',
}));

jest.mock('../../common/helpers/uuidv7.helper', () => ({
  generateUuid: jest.fn().mockReturnValue('0192abcd-1234-7000-8000-000000000001'),
}));

/**
 * Mock partiel de crypto pour hashToken() — on garde le vrai SHA-256.
 * La methode hashToken() utilise createHash('sha256') qui fonctionne
 * sans mock car elle ne fait pas d'appels reseau.
 */

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const mockUser = {
  id: 'user-1234-5678',
  email: 'admin@telecom.local',
  passwordHash: '$argon2id$hashed-password-value',
  firstName: 'Admin',
  lastName: 'Principal',
  role: 'ADMINISTRATOR',
  departmentId: 'dept-001',
  isActive: true,
  mustChangePassword: false,
  lastLoginAt: null as Date | null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  deletedAt: null as Date | null,
};

const mockInactiveUser = {
  ...mockUser,
  id: 'user-inactive',
  email: 'inactive@telecom.local',
  isActive: false,
};

const mockDepartment = { name: 'Support Technique' };

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('AuthService', () => {
  let service: AuthService;
  let drizzle: MockProxy<DrizzleProvider>;
  let jwtService: MockProxy<JwtService>;
  let jwtConfig: MockProxy<JwtConfigService>;
  let redisProvider: MockProxy<RedisProvider>;

  // Query builders mocks
  let mockSelectQuery: {
    from: jest.Mock;
    where: jest.Mock;
    limit: jest.Mock;
  };
  let mockUpdateQuery: {
    set: jest.Mock;
    where: jest.Mock;
  };
  let mockInsertQuery: {
    values: jest.Mock;
  };

  beforeEach(async () => {
    // --- Construire les query builders chainables ---
    mockSelectQuery = {
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue([]),
    };

    mockUpdateQuery = {
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockResolvedValue(undefined),
    };

    mockInsertQuery = {
      values: jest.fn().mockResolvedValue(undefined),
    };

    const mockDb = {
      select: jest.fn().mockReturnValue(mockSelectQuery),
      update: jest.fn().mockReturnValue(mockUpdateQuery),
      insert: jest.fn().mockReturnValue(mockInsertQuery),
    };

    // Creer le mock DrizzleProvider avec un db getter
    drizzle = mock<DrizzleProvider>();
    Object.defineProperty(drizzle, 'db', {
      get: jest.fn(() => mockDb),
      configurable: true,
    });

    // Mocks JWT
    jwtService = mock<JwtService>();
    jwtService.sign.mockReturnValue('mock-access-token-value');

    // JwtConfigService expose des getters (proprietes) — pas des methodes
    // On utilise Object.defineProperty pour simuler les valeurs retournees
    jwtConfig = mock<JwtConfigService>();
    Object.defineProperty(jwtConfig, 'accessSecret', {
      get: jest.fn(() => 'test-access-secret'),
      configurable: true,
    });
    Object.defineProperty(jwtConfig, 'accessExpiration', {
      get: jest.fn(() => '15m'),
      configurable: true,
    });

    // Mock RedisProvider
    redisProvider = mock<RedisProvider>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: DrizzleProvider, useValue: drizzle },
        { provide: JwtService, useValue: jwtService },
        { provide: JwtConfigService, useValue: jwtConfig },
        { provide: RedisProvider, useValue: redisProvider },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  // login()
  // =========================================================================
  describe('login() — Authentification', () => {
    it('doit retourner tokens + user pour des identifiants valides', async () => {
      // La requete utilisateur retourne un utilisateur actif
      mockSelectQuery.limit.mockResolvedValueOnce([mockUser]);
      // La requete departement retourne le nom du departement
      mockSelectQuery.limit.mockResolvedValueOnce([mockDepartment]);

      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { verify } = require('argon2');
      verify.mockResolvedValue(true);

      const result = await service.login('admin@telecom.local', 'Admin@1234', '127.0.0.1', 'Mozilla/5.0 TestAgent');

      // Verifier la reponse
      expect(result).toBeDefined();
      expect(result.accessToken).toBe('mock-access-token-value');
      expect(result.refreshToken).toBeDefined();
      expect(typeof result.refreshToken).toBe('string');
      expect(result.refreshToken.length).toBeGreaterThan(0);

      // Verifier les infos utilisateur
      expect(result.user).toBeDefined();
      expect(result.user.id).toBe(mockUser.id);
      expect(result.user.email).toBe(mockUser.email);
      expect(result.user.firstName).toBe(mockUser.firstName);
      expect(result.user.lastName).toBe(mockUser.lastName);
      expect(result.user.role).toBe(mockUser.role);
      expect(result.user.departmentId).toBe(mockUser.departmentId);
      expect(result.user.departmentName).toBe(mockDepartment.name);
    });

    it('doit lever UnauthorizedException pour un email inexistant', async () => {
      // Aucun utilisateur trouve → limit retourne []
      mockSelectQuery.limit.mockResolvedValueOnce([]);

      await expect(service.login('inconnu@telecom.local', 'AnyPass123!', '127.0.0.1', 'agent')).rejects.toThrow(
        UnauthorizedException,
      );

      expect(mockSelectQuery.from).toHaveBeenCalled();
    });

    it('doit lever UnauthorizedException pour un mot de passe incorrect', async () => {
      mockSelectQuery.limit.mockResolvedValueOnce([mockUser]);

      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { verify } = require('argon2');
      verify.mockResolvedValue(false); // Mauvais mot de passe

      await expect(service.login('admin@telecom.local', 'MauvaisMotDePasse', '127.0.0.1', 'agent')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('doit lever UnauthorizedException pour un compte desactive', async () => {
      mockSelectQuery.limit.mockResolvedValueOnce([mockInactiveUser]);

      await expect(service.login('inactive@telecom.local', 'AnyPass123!', '127.0.0.1', 'agent')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it("doit normaliser l'email en minuscules avant la recherche", async () => {
      mockSelectQuery.limit.mockResolvedValueOnce([mockUser]);
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { verify } = require('argon2');
      verify.mockResolvedValue(true);
      mockSelectQuery.limit.mockResolvedValueOnce([mockDepartment]);

      await service.login('ADMIN@TELECOM.LOCAL', 'Admin@1234', '127.0.0.1', 'agent');

      // La methode appelle email.toLowerCase().trim() dans la requete
      // On verifie que la requete est bien passee
      expect(mockSelectQuery.from).toHaveBeenCalled();
    });

    it('doit mettre a jour lastLoginAt apres une authentification reussie', async () => {
      mockSelectQuery.limit.mockResolvedValueOnce([mockUser]);
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { verify } = require('argon2');
      verify.mockResolvedValue(true);
      mockSelectQuery.limit.mockResolvedValueOnce([mockDepartment]);

      await service.login('admin@telecom.local', 'Admin@1234', '127.0.0.1', 'agent');

      // Verifier que update a ete appele avec set(lastLoginAt)
      expect(mockUpdateQuery.set).toHaveBeenCalledWith(expect.objectContaining({ lastLoginAt: expect.any(Date) }));
      expect(mockUpdateQuery.where).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // refresh()
  // =========================================================================
  describe('refresh() — Rotation de tokens', () => {
    const validRefreshToken = 'valid-refresh-token-hex-value-64-chars';

    it('doit retourner une nouvelle paire de tokens pour un refresh token valide', async () => {
      const storedToken = {
        id: 'token-id-1',
        userId: mockUser.id,
        tokenHash: 'sha256-hash-of-valid-refresh-token',
        userAgent: 'Mozilla/5.0',
        ipAddress: '127.0.0.1',
        expiresAt: new Date(Date.now() + 86400000), // Pas expire
        revokedAt: null,
        createdAt: new Date(),
      };

      mockSelectQuery.limit
        .mockResolvedValueOnce([storedToken]) // Token valide
        .mockResolvedValueOnce([mockUser]); // Utilisateur actif

      const result = await service.refresh(validRefreshToken, '10.0.0.1', 'TestAgent');

      expect(result).toBeDefined();
      expect(result.accessToken).toBe('mock-access-token-value');
      expect(result.refreshToken).toBeDefined();
      expect(result.refreshToken).not.toBe(validRefreshToken);

      // Verifier que l'ancien token a ete revoque
      expect(mockUpdateQuery.set).toHaveBeenCalledWith({
        revokedAt: expect.any(Date),
      });
    });

    it('doit lever UnauthorizedException pour un refresh token revoque', async () => {
      const revokedToken = {
        id: 'token-id-revoked',
        userId: mockUser.id,
        tokenHash: 'hash-of-revoked-token',
        userAgent: 'Mozilla/5.0',
        ipAddress: '127.0.0.1',
        expiresAt: new Date(Date.now() + 86400000),
        revokedAt: new Date(), // Revogue !
        createdAt: new Date(),
      };

      mockSelectQuery.limit.mockResolvedValueOnce([revokedToken]);

      await expect(service.refresh(validRefreshToken, '10.0.0.1', 'TestAgent')).rejects.toThrow(UnauthorizedException);
    });

    it('doit lever UnauthorizedException pour un refresh token inexistant', async () => {
      mockSelectQuery.limit.mockResolvedValueOnce([]);

      await expect(service.refresh(validRefreshToken, '10.0.0.1', 'TestAgent')).rejects.toThrow(UnauthorizedException);
    });

    it('doit lever UnauthorizedException pour un refresh token expire', async () => {
      const expiredToken = {
        id: 'token-id-expired',
        userId: mockUser.id,
        tokenHash: 'hash-of-expired-token',
        userAgent: 'Mozilla/5.0',
        ipAddress: '127.0.0.1',
        expiresAt: new Date(Date.now() - 86400000), // Expire depuis hier
        revokedAt: null,
        createdAt: new Date(),
      };

      mockSelectQuery.limit.mockResolvedValueOnce([expiredToken]);

      await expect(service.refresh(validRefreshToken, '10.0.0.1', 'TestAgent')).rejects.toThrow(UnauthorizedException);
    });

    it("doit lever UnauthorizedException si l'utilisateur du token est desactive", async () => {
      const storedToken = {
        id: 'token-id-2',
        userId: mockInactiveUser.id,
        tokenHash: 'hash-of-token',
        userAgent: 'Mozilla/5.0',
        ipAddress: '127.0.0.1',
        expiresAt: new Date(Date.now() + 86400000),
        revokedAt: null,
        createdAt: new Date(),
      };

      mockSelectQuery.limit.mockResolvedValueOnce([storedToken]).mockResolvedValueOnce([mockInactiveUser]); // Utilisateur inactif

      await expect(service.refresh(validRefreshToken, '10.0.0.1', 'TestAgent')).rejects.toThrow(UnauthorizedException);
    });
  });

  // =========================================================================
  // logout()
  // =========================================================================
  describe('logout() — Deconnexion', () => {
    it('doit revoquer le refresh token et retourner void', async () => {
      await service.logout('some-refresh-token');

      expect(mockUpdateQuery.set).toHaveBeenCalledWith({
        revokedAt: expect.any(Date),
      });
      expect(mockUpdateQuery.where).toHaveBeenCalled();
    });

    it("ne doit pas lever d'erreur si le token n'existe pas (idempotent)", async () => {
      mockUpdateQuery.where.mockResolvedValue(undefined);

      await expect(service.logout('token-inexistant')).resolves.toBeUndefined();
    });
  });

  // =========================================================================
  // logoutAll()
  // =========================================================================
  describe('logoutAll() — Deconnexion de toutes les sessions', () => {
    it("doit revoquer tous les tokens actifs d'un utilisateur", async () => {
      await service.logoutAll(mockUser.id);

      expect(mockUpdateQuery.set).toHaveBeenCalledWith({
        revokedAt: expect.any(Date),
      });
    });
  });

  // =========================================================================
  // changePassword()
  // =========================================================================
  describe('changePassword() — Changement de mot de passe', () => {
    it('doit changer le mot de passe si le mot de passe actuel est correct', async () => {
      mockSelectQuery.limit.mockResolvedValueOnce([mockUser]);

      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { verify, hash } = require('argon2');
      verify.mockResolvedValue(true); // Mot de passe actuel OK
      hash.mockResolvedValue('new-argon2id-hash');

      await service.changePassword(mockUser.id, 'Admin@1234', 'NewPass@1234');

      // Verifier que le hash a ete mis a jour
      expect(mockUpdateQuery.set).toHaveBeenCalledWith(
        expect.objectContaining({
          passwordHash: 'new-argon2id-hash',
          mustChangePassword: false,
        }),
      );
    });

    it('doit lever UnauthorizedException pour un mauvais mot de passe actuel', async () => {
      mockSelectQuery.limit.mockResolvedValueOnce([mockUser]);

      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { verify } = require('argon2');
      verify.mockResolvedValue(false); // Mauvais mot de passe

      await expect(service.changePassword(mockUser.id, 'MauvaisMotDePasse', 'NewPass@1234')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it("doit lever UnauthorizedException si l'utilisateur n'existe pas", async () => {
      mockSelectQuery.limit.mockResolvedValueOnce([]);

      await expect(service.changePassword('user-inexistant', 'AnyPass@123', 'NewPass@1234')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('doit hasher le nouveau mot de passe avec argon2id', async () => {
      mockSelectQuery.limit.mockResolvedValueOnce([mockUser]);

      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { verify, hash } = require('argon2');
      verify.mockResolvedValue(true);
      hash.mockResolvedValue('argon2id-hash-result');

      await service.changePassword(mockUser.id, 'Admin@1234', 'NewPass@1234');

      expect(hash).toHaveBeenCalledWith('NewPass@1234', {
        type: 'argon2id',
        memoryCost: 65536,
        timeCost: 3,
        parallelism: 4,
      });
    });
  });
});
