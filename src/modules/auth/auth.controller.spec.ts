/* eslint-disable @typescript-eslint/no-explicit-any */
import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { mock, MockProxy } from 'jest-mock-extended';
import { Request } from 'express';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const mockUser: JwtPayload = {
  sub: 'user-001',
  email: 'agent@telecom.local',
  role: 'CUSTOMER_SERVICE_AGENT',
  departmentId: 'dept-001',
  jti: 'jti-001',
};

const loginResult = {
  accessToken: 'mock-access-token',
  refreshToken: 'mock-refresh-token',
  user: {
    id: 'user-001',
    email: 'agent@telecom.local',
    firstName: 'Jean',
    lastName: 'Dupont',
    role: 'CUSTOMER_SERVICE_AGENT',
    departmentId: 'dept-001',
    departmentName: 'Support Technique',
  },
};

const refreshResult = {
  accessToken: 'new-access-token',
  refreshToken: 'new-refresh-token',
  user: {
    id: 'user-001',
    email: 'agent@telecom.local',
    role: 'CUSTOMER_SERVICE_AGENT',
    departmentId: 'dept-001',
  },
};

const changePasswordResult = {
  message: 'Mot de passe modifié avec succès.',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('AuthController', () => {
  let controller: AuthController;
  let authService: MockProxy<AuthService>;

  /** Construit un objet Request minimal pour les tests */
  function makeMockRequest(ip = '127.0.0.1', userAgent = 'Mozilla/5.0 TestAgent'): Partial<Request> {
    return {
      ip,
      socket: { remoteAddress: '10.0.0.1' } as any,
      headers: { 'user-agent': userAgent },
    };
  }

  beforeEach(async () => {
    authService = mock<AuthService>();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authService }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  // login()
  // =========================================================================
  describe('POST /auth/login', () => {
    it('doit authentifier un utilisateur avec des identifiants valides', async () => {
      authService.login.mockResolvedValue(loginResult);
      const dto: LoginDto = { email: 'agent@telecom.local', password: 'Pass@1234' };
      const req = makeMockRequest() as Request;

      const result = await controller.login(dto, req);

      expect(authService.login).toHaveBeenCalledWith(dto.email, dto.password, '127.0.0.1', 'Mozilla/5.0 TestAgent');
      expect(result).toEqual(loginResult);
    });

    it("doit utiliser l'adresse IP et le user-agent de la requête", async () => {
      authService.login.mockResolvedValue(loginResult);
      const dto: LoginDto = { email: 'admin@telecom.local', password: 'Admin@1234' };
      const req = makeMockRequest('192.168.1.1', 'curl/7.68.0') as Request;

      await controller.login(dto, req);

      expect(authService.login).toHaveBeenCalledWith(dto.email, dto.password, '192.168.1.1', 'curl/7.68.0');
    });

    it('doit utiliser "unknown" si IP et user-agent sont absents', async () => {
      authService.login.mockResolvedValue(loginResult);
      const dto: LoginDto = { email: 'admin@telecom.local', password: 'Admin@1234' };
      const req = { ip: undefined, socket: { remoteAddress: undefined } as any, headers: {} } as Request;

      await controller.login(dto, req);

      expect(authService.login).toHaveBeenCalledWith(dto.email, dto.password, 'unknown', 'unknown');
    });

    it('doit propager UnauthorizedException du service', async () => {
      authService.login.mockRejectedValue(new Error('Identifiants invalides.'));
      const dto: LoginDto = { email: 'inconnu@telecom.local', password: 'WrongPass' };
      const req = makeMockRequest() as Request;

      await expect(controller.login(dto, req)).rejects.toThrow('Identifiants invalides.');
    });
  });

  // =========================================================================
  // refresh()
  // =========================================================================
  describe('POST /auth/refresh', () => {
    it('doit retourner une nouvelle paire de tokens', async () => {
      authService.refresh.mockResolvedValue(refreshResult);
      const dto: RefreshDto = { refreshToken: 'valid-refresh-token' };
      const req = makeMockRequest() as Request;

      const result = await controller.refresh(dto, req);

      expect(authService.refresh).toHaveBeenCalledWith(dto.refreshToken, '127.0.0.1', 'Mozilla/5.0 TestAgent');
      expect(result).toEqual(refreshResult);
    });

    it('doit propager les erreurs du service', async () => {
      authService.refresh.mockRejectedValue(new Error('Refresh token invalide.'));
      const dto: RefreshDto = { refreshToken: 'expired-token' };
      const req = makeMockRequest() as Request;

      await expect(controller.refresh(dto, req)).rejects.toThrow('Refresh token invalide.');
    });
  });

  // =========================================================================
  // logout()
  // =========================================================================
  describe('POST /auth/logout', () => {
    it('doit révoquer le refresh token et retourner 204', async () => {
      authService.logout.mockResolvedValue(undefined);
      const dto: RefreshDto = { refreshToken: 'token-a-revoquer' };

      const result = await controller.logout(dto);

      expect(authService.logout).toHaveBeenCalledWith(dto.refreshToken);
      expect(result).toBeUndefined();
    });

    it('doit fonctionner même si le token est déjà révoqué (idempotent)', async () => {
      authService.logout.mockResolvedValue(undefined);
      const dto: RefreshDto = { refreshToken: 'token-deja-revoque' };

      await expect(controller.logout(dto)).resolves.toBeUndefined();
    });
  });

  // =========================================================================
  // logoutAll()
  // =========================================================================
  describe('POST /auth/logout-all', () => {
    it('doit révoquer toutes les sessions et retourner 204', async () => {
      authService.logoutAll.mockResolvedValue(undefined);

      const result = await controller.logoutAll(mockUser);

      expect(authService.logoutAll).toHaveBeenCalledWith(mockUser.sub);
      expect(result).toBeUndefined();
    });

    it('doit utiliser le sub du JWT comme userId', async () => {
      authService.logoutAll.mockResolvedValue(undefined);

      await controller.logoutAll(mockUser);

      expect(authService.logoutAll).toHaveBeenCalledWith('user-001');
    });
  });

  // =========================================================================
  // me()
  // =========================================================================
  describe('GET /auth/me', () => {
    it("doit retourner le payload JWT de l'utilisateur connecté", async () => {
      const result = await controller.me(mockUser);

      expect(result).toEqual(mockUser);
      expect(result.sub).toBe('user-001');
      expect(result.email).toBe('agent@telecom.local');
      expect(result.role).toBe('CUSTOMER_SERVICE_AGENT');
    });

    it('doit retourner le payload pour un administrateur', async () => {
      const admin: JwtPayload = {
        sub: 'admin-001',
        email: 'admin@telecom.local',
        role: 'ADMINISTRATOR',
        departmentId: 'dept-001',
        jti: 'jti-002',
      };

      const result = await controller.me(admin);

      expect(result.role).toBe('ADMINISTRATOR');
    });
  });

  // =========================================================================
  // changePassword()
  // =========================================================================
  describe('PUT /auth/change-password', () => {
    it('doit changer le mot de passe avec succès', async () => {
      authService.changePassword.mockResolvedValue(undefined);
      const dto: ChangePasswordDto = {
        currentPassword: 'OldPass@1234',
        newPassword: 'NewPass@5678',
      };

      const result = await controller.changePassword(mockUser, dto);

      expect(authService.changePassword).toHaveBeenCalledWith(mockUser.sub, dto.currentPassword, dto.newPassword);
      expect(result).toEqual(changePasswordResult);
    });

    it('doit utiliser le sub du JWT comme userId', async () => {
      authService.changePassword.mockResolvedValue(undefined);
      const dto: ChangePasswordDto = {
        currentPassword: 'OldPass@1234',
        newPassword: 'NewPass@5678',
      };

      await controller.changePassword(mockUser, dto);

      expect(authService.changePassword).toHaveBeenCalledWith('user-001', dto.currentPassword, dto.newPassword);
    });

    it('doit propager UnauthorizedException pour un mauvais mot de passe actuel', async () => {
      authService.changePassword.mockRejectedValue(new Error('Mot de passe actuel incorrect.'));
      const dto: ChangePasswordDto = {
        currentPassword: 'WrongPass@1234',
        newPassword: 'NewPass@5678',
      };

      await expect(controller.changePassword(mockUser, dto)).rejects.toThrow('Mot de passe actuel incorrect.');
    });

    it('doit retourner un message de confirmation', async () => {
      authService.changePassword.mockResolvedValue(undefined);
      const dto: ChangePasswordDto = {
        currentPassword: 'OldPass@1234',
        newPassword: 'NewPass@5678',
      };

      const result = await controller.changePassword(mockUser, dto);

      expect(result.message).toBe('Mot de passe modifié avec succès.');
    });
  });
});
