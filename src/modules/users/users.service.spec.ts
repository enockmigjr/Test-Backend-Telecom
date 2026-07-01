/* eslint-disable @typescript-eslint/no-explicit-any */
import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { DrizzleProvider } from '../../database/drizzle.provider';
import { NotFoundException } from '@nestjs/common';
import { mockDeep } from 'jest-mock-extended';

/**
 * Tests unitaires du UsersService.
 * Mocke DrizzleProvider pour isoler la logique métier.
 */
describe('UsersService', () => {
  let service: UsersService;
  let mockDb: ReturnType<typeof mockDeep<DrizzleProvider>>;

  beforeEach(async () => {
    mockDb = mockDeep<DrizzleProvider>();

    // Mock les méthodes Drizzle chaînables
    (mockDb as any).db = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
    };

    const mockQueues = { email: { add: jest.fn().mockResolvedValue(undefined) }, notification: { add: jest.fn().mockResolvedValue(undefined) } };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: DrizzleProvider, useValue: mockDb },
        { provide: 'BullMQ_Queues', useValue: mockQueues },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('findOne doit retourner un utilisateur existant', async () => {
    const mockUser = {
      id: '1',
      email: 'test@test.com',
      firstName: 'Test',
      lastName: 'User',
      role: 'ADMINISTRATOR',
      isActive: true,
      departmentId: 'd1',
    };
    (mockDb.db as any).where.mockReturnValueOnce({ limit: jest.fn().mockResolvedValueOnce([mockUser]) });

    const result = await service.findOne('1');
    expect(result).toBeDefined();
  });

  it('findOne doit lancer NotFoundException si utilisateur inexistant', async () => {
    (mockDb.db as any).where.mockReturnValueOnce({ limit: jest.fn().mockResolvedValueOnce([]) });
    await expect(service.findOne('inexistant')).rejects.toThrow(NotFoundException);
  });

  it('deactivate doit désactiver un utilisateur actif', async () => {
    const mockUser = {
      id: '1',
      email: 'test@test.com',
      firstName: 'Test',
      lastName: 'User',
      role: 'ADMINISTRATOR',
      isActive: true,
      departmentId: 'd1',
    };
    (mockDb.db as any).where.mockReturnValueOnce({ limit: jest.fn().mockResolvedValueOnce([mockUser]) });
    (mockDb.db as any).where.mockReturnValueOnce({});

    const result = await service.deactivate('1');
    expect(result.message).toContain('désactivé');
    expect(result.message).toContain('succès');
  });

  it('activate doit réactiver un utilisateur inactif', async () => {
    const mockUser = {
      id: '1',
      email: 'test@test.com',
      firstName: 'Test',
      lastName: 'User',
      role: 'ADMINISTRATOR',
      isActive: false,
      departmentId: 'd1',
    };
    (mockDb.db as any).where.mockReturnValueOnce({ limit: jest.fn().mockResolvedValueOnce([mockUser]) });
    (mockDb.db as any).where.mockReturnValueOnce({});

    const result = await service.activate('1');
    expect(result.message).toContain('réactivé');
  });
});
