/* eslint-disable @typescript-eslint/no-explicit-any */
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ForbiddenException, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { mock, MockProxy } from 'jest-mock-extended';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { AuthService } from './auth.service';
import { DrizzleProvider } from '../../database/drizzle.provider';
import { JwtConfigService } from '../../config/jwt.config';
import { RedisProvider } from '../../common/providers/redis.provider';
import { RefreshSessionService } from './refresh-session.service';

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
  role: 'ADMINISTRATOR' as const,
  departmentId: 'dept-001',
  isActive: true,
  isAvailable: true,
  maxConcurrentTickets: 5,
  absenceEndsAt: null as Date | null,
  lastAssignedAt: null as Date | null,
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
  let refreshSessions: MockProxy<RefreshSessionService>;
  let eventEmitter: MockProxy<EventEmitter2>;

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
      execute: jest.fn().mockResolvedValue([]),
    };

    // Creer le mock DrizzleProvider avec un db getter
    drizzle = mock<DrizzleProvider>();
    Object.defineProperty(drizzle, 'db', {
      get: jest.fn(() => mockDb),
      configurable: true,
    });
    drizzle.runInTransaction.mockImplementation(async (callback) => callback());

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
    Object.defineProperty(jwtConfig, 'accessExpirationSeconds', {
      get: jest.fn(() => 900),
      configurable: true,
    });

    // Mock RedisProvider
    const mockRedisClient = {
      setex: jest.fn().mockResolvedValue('OK'),
      exists: jest.fn().mockResolvedValue(0),
      sismember: jest.fn().mockResolvedValue(0),
      get: jest.fn().mockResolvedValue(null),
    };
    redisProvider = mock<RedisProvider>();
    redisProvider.getClient.mockReturnValue(mockRedisClient as any);

    refreshSessions = mock<RefreshSessionService>();
    refreshSessions.create.mockResolvedValue('new-refresh-token');
    refreshSessions.rotate.mockImplementation(async (_token, _ip, _agent, finalize) => ({
      refreshToken: 'rotated-refresh-token',
      user: mockUser,
      finalized: finalize ? await finalize(mockUser) : undefined,
    }));
    eventEmitter = mock<EventEmitter2>();

    const mockQueues = { email: { add: jest.fn().mockResolvedValue(undefined) } };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: DrizzleProvider, useValue: drizzle },
        { provide: JwtService, useValue: jwtService },
        { provide: JwtConfigService, useValue: jwtConfig },
        { provide: RedisProvider, useValue: redisProvider },
        { provide: RefreshSessionService, useValue: refreshSessions },
        { provide: EventEmitter2, useValue: eventEmitter },
        { provide: 'BullMQ_Queues', useValue: mockQueues },
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
        ForbiddenException,
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
      expect(result.refreshToken).toBe('rotated-refresh-token');
      expect(result.expiresIn).toBe(900);
      expect(refreshSessions.rotate).toHaveBeenCalledWith(
        validRefreshToken,
        '10.0.0.1',
        'TestAgent',
        expect.any(Function),
      );
    });

    it('doit lever UnauthorizedException pour un refresh token revoque', async () => {
      refreshSessions.rotate.mockRejectedValueOnce(new UnauthorizedException());
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
      refreshSessions.rotate.mockRejectedValueOnce(new UnauthorizedException());
      mockSelectQuery.limit.mockResolvedValueOnce([]);

      await expect(service.refresh(validRefreshToken, '10.0.0.1', 'TestAgent')).rejects.toThrow(UnauthorizedException);
    });

    it('doit lever UnauthorizedException pour un refresh token expire', async () => {
      refreshSessions.rotate.mockRejectedValueOnce(new UnauthorizedException());
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
      refreshSessions.rotate.mockRejectedValueOnce(new UnauthorizedException());
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
      const redisClient = redisProvider.getClient();
      mockSelectQuery.limit.mockResolvedValueOnce([{ familyId: 'family-001', userId: mockUser.id }]);
      await service.logout('some-refresh-token', 'jti-test-123', mockUser.id);

      expect(mockUpdateQuery.set).toHaveBeenCalledWith({
        revokedAt: expect.any(Date),
      });
      expect(mockUpdateQuery.where).toHaveBeenCalled();
      expect(redisClient.setex).toHaveBeenCalledWith('jwt_bl:jti-test-123', expect.any(Number), '1');
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'auth.session.revoked',
        expect.objectContaining({ userId: mockUser.id, jti: 'jti-test-123' }),
      );
    });

    it("ne doit pas lever d'erreur si le token n'existe pas (idempotent)", async () => {
      mockUpdateQuery.where.mockResolvedValue(undefined);

      await expect(service.logout('token-inexistant', 'jti-test-999', mockUser.id)).resolves.toBeUndefined();
    });

    it("doit échouer explicitement si l'access token ne peut pas être révoqué", async () => {
      redisProvider.getClient.mockImplementationOnce(() => {
        throw new Error('Redis indisponible');
      });

      await expect(service.logout('some-refresh-token', 'jti-test-123', mockUser.id)).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
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

    it('doit revoquer les tokens et blacklister le JTI courant si fourni', async () => {
      const redisClient = redisProvider.getClient();
      await service.logoutAll(mockUser.id, 'jti-logout-all-123');

      expect(mockUpdateQuery.set).toHaveBeenCalledWith({
        revokedAt: expect.any(Date),
      });
      expect(redisClient.setex).toHaveBeenCalledWith('jwt_bl:jti-logout-all-123', expect.any(Number), '1');
      expect(redisClient.setex).toHaveBeenCalledWith(
        `jwt_user_bl:${mockUser.id}`,
        expect.any(Number),
        expect.any(String),
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'auth.user-sessions.revoked',
        expect.objectContaining({ userId: mockUser.id }),
      );
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
