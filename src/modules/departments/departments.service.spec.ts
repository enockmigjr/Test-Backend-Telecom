/* eslint-disable @typescript-eslint/no-explicit-any */
import { Test, TestingModule } from '@nestjs/testing';
import { DepartmentsService } from './departments.service';
import { DrizzleProvider } from '../../database/drizzle.provider';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { mock, MockProxy } from 'jest-mock-extended';
import { departments, users, tickets } from '../../database/schemas';
import { eq } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// Mock uuidv7
// ---------------------------------------------------------------------------
jest.mock('../../common/helpers/uuidv7.helper', () => ({
  generateUuid: jest.fn().mockReturnValue('0192abcd-1234-7000-8000-000000000001'),
}));

// ---------------------------------------------------------------------------
// Helper : construit un query builder chainable et thenable
// ---------------------------------------------------------------------------
function createMockQueryBuilder<T>(defaultResult: T[]) {
  const builder: any = {
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    offset: jest.fn().mockReturnThis(),
    then: jest.fn((resolve: (val: T[]) => void) => resolve(defaultResult)),
    catch: jest.fn(),
  };
  return builder;
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const mockDepartment = {
  id: '0192abcd-1234-7000-8000-000000000001',
  name: 'Support Technique',
  description: 'Departement support technique',
  createdAt: new Date('2026-01-01T10:00:00Z'),
  updatedAt: new Date('2026-01-01T10:00:00Z'),
  deletedAt: null,
};

const mockDepartment2 = {
  id: 'dept-002',
  name: 'NOC',
  description: 'Network Operations Center',
  createdAt: new Date('2026-01-02T10:00:00Z'),
  updatedAt: new Date('2026-01-02T10:00:00Z'),
  deletedAt: null,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('DepartmentsService', () => {
  let service: DepartmentsService;
  let drizzle: MockProxy<DrizzleProvider>;
  let mockDb: {
    select: jest.Mock;
    insert: jest.Mock;
    update: jest.Mock;
  };

  beforeEach(async () => {
    mockDb = {
      select: jest.fn(),
      insert: jest.fn().mockReturnValue({
        values: jest.fn().mockResolvedValue(undefined),
      }),
      update: jest.fn().mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue(undefined),
        }),
      }),
    };

    drizzle = mock<DrizzleProvider>();
    Object.defineProperty(drizzle, 'db', {
      get: jest.fn(() => mockDb),
      configurable: true,
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [DepartmentsService, { provide: DrizzleProvider, useValue: drizzle }],
    }).compile();

    service = module.get<DepartmentsService>(DepartmentsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  // findAll()
  // =========================================================================
  describe('findAll() — Liste des departements', () => {
    it('doit retourner tous les departements tries par nom', async () => {
      const builder = createMockQueryBuilder([mockDepartment, mockDepartment2]);
      mockDb.select.mockReturnValueOnce(builder);

      const result = await service.findAll();

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Support Technique');
      expect(result[1].name).toBe('NOC');
    });

    it('doit retourner une liste vide si aucun departement', async () => {
      const builder = createMockQueryBuilder([]);
      mockDb.select.mockReturnValueOnce(builder);

      const result = await service.findAll();

      expect(result).toHaveLength(0);
    });

    it('doit selectionner depuis la table departments avec orderBy name', async () => {
      const builder = createMockQueryBuilder([mockDepartment, mockDepartment2]);
      mockDb.select.mockReturnValueOnce(builder);

      await service.findAll();

      const selectCall = (mockDb.select as jest.Mock).mock.results[0].value;
      expect(selectCall.from).toHaveBeenCalledWith(departments);
      expect(selectCall.orderBy).toHaveBeenCalledWith(departments.name);
    });
  });

  // =========================================================================
  // findOne()
  // =========================================================================
  describe('findOne() — Recherche par ID', () => {
    it('doit retourner un departement existant', async () => {
      const builder = createMockQueryBuilder([mockDepartment]);
      mockDb.select.mockReturnValueOnce(builder);

      const result = await service.findOne(mockDepartment.id);

      expect(result).toEqual(mockDepartment);
      expect(result.id).toBe('0192abcd-1234-7000-8000-000000000001');
    });

    it("doit lancer NotFoundException si le departement n'existe pas", async () => {
      const builder = createMockQueryBuilder([]);
      mockDb.select.mockReturnValueOnce(builder);

      await expect(service.findOne('inexistant')).rejects.toThrow(NotFoundException);
    });

    it('doit appliquer un filtre where avec le bon id', async () => {
      const builder = createMockQueryBuilder([mockDepartment]);
      mockDb.select.mockReturnValueOnce(builder);

      await service.findOne('dept-specific');

      const selectCall = (mockDb.select as jest.Mock).mock.results[0].value;
      expect(selectCall.from).toHaveBeenCalledWith(departments);
      expect(selectCall.where).toHaveBeenCalled();
      expect(selectCall.limit).toHaveBeenCalledWith(1);
    });
  });

  // =========================================================================
  // create()
  // =========================================================================
  describe('create() — Creation', () => {
    it('doit creer un nouveau departement', async () => {
      const checkBuilder = createMockQueryBuilder([]);
      const createdBuilder = createMockQueryBuilder([mockDepartment]);
      mockDb.select.mockReturnValueOnce(checkBuilder).mockReturnValueOnce(createdBuilder);

      const result = await service.create({
        name: 'Support Technique',
        description: 'Departement support technique',
      });

      expect(mockDb.insert).toHaveBeenCalledWith(departments);
      expect(mockDb.insert().values).toHaveBeenCalledWith({
        id: '0192abcd-1234-7000-8000-000000000001',
        name: 'Support Technique',
        description: 'Departement support technique',
      });
      expect(result.message).toContain('créé');
      expect(result.data).toEqual(mockDepartment);
    });

    it('doit creer un departement sans description', async () => {
      const checkBuilder = createMockQueryBuilder([]);
      const deptNoDesc = { ...mockDepartment, description: null };
      const createdBuilder = createMockQueryBuilder([deptNoDesc]);
      mockDb.select.mockReturnValueOnce(checkBuilder).mockReturnValueOnce(createdBuilder);

      const result = await service.create({ name: 'Support' });

      expect(mockDb.insert().values).toHaveBeenCalledWith(expect.objectContaining({ description: null }));
      expect(result.data.description).toBeNull();
    });

    it('doit lancer ConflictException si le nom existe deja', async () => {
      const builder = createMockQueryBuilder([{ id: 'existing-id' }]);
      mockDb.select.mockReturnValue(builder);

      await expect(service.create({ name: 'Support Technique' })).rejects.toThrow(ConflictException);
      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it('doit verifier l unicite par nom avant creation', async () => {
      const builder = createMockQueryBuilder([]);
      const createdBuilder = createMockQueryBuilder([mockDepartment]);
      mockDb.select.mockReturnValueOnce(builder).mockReturnValueOnce(createdBuilder);

      await service.create({ name: 'Support Technique' });

      const uniquenessCall = (mockDb.select as jest.Mock).mock.calls[0][0];
      expect(uniquenessCall).toEqual({ id: departments.id });
    });

    it("doit retourner l'id genere dans le message de succes", async () => {
      const checkBuilder = createMockQueryBuilder([]);
      const createdBuilder = createMockQueryBuilder([mockDepartment]);
      mockDb.select.mockReturnValueOnce(checkBuilder).mockReturnValueOnce(createdBuilder);

      const result = await service.create({ name: 'Billing' });

      expect(result.data.id).toBe('0192abcd-1234-7000-8000-000000000001');
    });
  });

  // =========================================================================
  // update()
  // =========================================================================
  describe('update() — Mise a jour', () => {
    it('doit mettre a jour un departement existant', async () => {
      const findBuilder = createMockQueryBuilder([mockDepartment]);
      const updatedDept = {
        ...mockDepartment,
        name: 'Support Niveau 1',
        description: 'Mis a jour',
      };
      const updatedBuilder = createMockQueryBuilder([updatedDept]);
      mockDb.select.mockReturnValueOnce(findBuilder).mockReturnValueOnce(updatedBuilder);

      const result = await service.update(mockDepartment.id, {
        name: 'Support Niveau 1',
        description: 'Mis a jour',
      });

      expect(result.message).toContain('à jour');
      expect(mockDb.update).toHaveBeenCalledWith(departments);
      expect(mockDb.update().set).toHaveBeenCalledWith({
        name: 'Support Niveau 1',
        description: 'Mis a jour',
      });
      expect(mockDb.update().set().where).toHaveBeenCalledWith(eq(departments.id, mockDepartment.id));
      expect(result.data.name).toBe('Support Niveau 1');
    });

    it("doit lancer NotFoundException si le departement n'existe pas", async () => {
      const builder = createMockQueryBuilder([]);
      mockDb.select.mockReturnValueOnce(builder);

      await expect(service.update('inexistant', { name: 'Test' })).rejects.toThrow(NotFoundException);
      expect(mockDb.update).not.toHaveBeenCalled();
    });

    it('doit mettre a jour seulement les champs fournis', async () => {
      const findBuilder = createMockQueryBuilder([mockDepartment]);
      const updatedDept = { ...mockDepartment, description: 'Nouvelle description' };
      const updatedBuilder = createMockQueryBuilder([updatedDept]);
      mockDb.select.mockReturnValueOnce(findBuilder).mockReturnValueOnce(updatedBuilder);

      await service.update(mockDepartment.id, { description: 'Nouvelle description' });

      expect(mockDb.update().set).toHaveBeenCalledWith({ description: 'Nouvelle description' });
    });

    it('doit mettre a jour uniquement le nom si seuleument name fourni', async () => {
      const findBuilder = createMockQueryBuilder([mockDepartment]);
      const updatedDept = { ...mockDepartment, name: 'New Name' };
      const updatedBuilder = createMockQueryBuilder([updatedDept]);
      mockDb.select.mockReturnValueOnce(findBuilder).mockReturnValueOnce(updatedBuilder);

      await service.update(mockDepartment.id, { name: 'New Name' });

      expect(mockDb.update().set).toHaveBeenCalledWith({ name: 'New Name' });
    });

    it('doit verifier l existence du departement avant mise a jour', async () => {
      const findBuilder = createMockQueryBuilder([mockDepartment]);
      const updatedBuilder = createMockQueryBuilder([mockDepartment]);
      mockDb.select.mockReturnValueOnce(findBuilder).mockReturnValueOnce(updatedBuilder);

      await service.update(mockDepartment.id, { name: 'Updated' });

      const firstSelect = (mockDb.select as jest.Mock).mock.results[0].value;
      expect(firstSelect.from).toHaveBeenCalledWith(departments);
    });
  });

  // =========================================================================
  // remove()
  // =========================================================================
  describe('remove() — Suppression (soft delete)', () => {
    it('doit effectuer un soft delete si aucun utilisateur ou ticket lie', async () => {
      const findBuilder = createMockQueryBuilder([mockDepartment]);
      const userCountBuilder = createMockQueryBuilder([{ count: 0 }]);
      const ticketCountBuilder = createMockQueryBuilder([{ count: 0 }]);
      mockDb.select
        .mockReturnValueOnce(findBuilder)
        .mockReturnValueOnce(userCountBuilder)
        .mockReturnValueOnce(ticketCountBuilder);

      await service.remove(mockDepartment.id);

      expect(mockDb.update).toHaveBeenCalledWith(departments);
      expect(mockDb.update().set).toHaveBeenCalledWith({ deletedAt: expect.any(Date) });
      expect(mockDb.update().set().where).toHaveBeenCalledWith(eq(departments.id, mockDepartment.id));
    });

    it('doit lancer ConflictException si des utilisateurs sont lies', async () => {
      const findBuilder = createMockQueryBuilder([mockDepartment]);
      const userCountBuilder = createMockQueryBuilder([{ count: 3 }]);
      mockDb.select.mockReturnValueOnce(findBuilder).mockReturnValueOnce(userCountBuilder);

      await expect(service.remove(mockDepartment.id)).rejects.toThrow(ConflictException);
      expect(mockDb.update).not.toHaveBeenCalled();
    });

    it('doit lancer ConflictException si des tickets sont lies', async () => {
      const findBuilder = createMockQueryBuilder([mockDepartment]);
      const userCountBuilder = createMockQueryBuilder([{ count: 0 }]);
      const ticketCountBuilder = createMockQueryBuilder([{ count: 5 }]);
      mockDb.select
        .mockReturnValueOnce(findBuilder)
        .mockReturnValueOnce(userCountBuilder)
        .mockReturnValueOnce(ticketCountBuilder);

      await expect(service.remove(mockDepartment.id)).rejects.toThrow(ConflictException);
      expect(mockDb.update).not.toHaveBeenCalled();
    });

    it("doit lancer NotFoundException si le departement n'existe pas", async () => {
      const builder = createMockQueryBuilder([]);
      mockDb.select.mockReturnValueOnce(builder);

      await expect(service.remove('inexistant')).rejects.toThrow(NotFoundException);
      expect(mockDb.update).not.toHaveBeenCalled();
    });

    it('doit verifier les utilisateurs lies avant les tickets lies', async () => {
      const findBuilder = createMockQueryBuilder([mockDepartment]);
      const userCountBuilder = createMockQueryBuilder([{ count: 0 }]);
      const ticketCountBuilder = createMockQueryBuilder([{ count: 0 }]);
      mockDb.select
        .mockReturnValueOnce(findBuilder)
        .mockReturnValueOnce(userCountBuilder)
        .mockReturnValueOnce(ticketCountBuilder);

      await service.remove(mockDepartment.id);

      const userSelect = (mockDb.select as jest.Mock).mock.results[1].value;
      expect(userSelect.from).toHaveBeenCalledWith(users);

      const ticketSelect = (mockDb.select as jest.Mock).mock.results[2].value;
      expect(ticketSelect.from).toHaveBeenCalledWith(tickets);
    });

    it('doit utiliser sql count(*) pour compter les enregistrements lies', async () => {
      const findBuilder = createMockQueryBuilder([mockDepartment]);
      const userCountBuilder = createMockQueryBuilder([{ count: 0 }]);
      const ticketCountBuilder = createMockQueryBuilder([{ count: 0 }]);
      mockDb.select
        .mockReturnValueOnce(findBuilder)
        .mockReturnValueOnce(userCountBuilder)
        .mockReturnValueOnce(ticketCountBuilder);

      await service.remove(mockDepartment.id);

      const userSelectArg = (mockDb.select as jest.Mock).mock.calls[1][0];
      expect(userSelectArg).toHaveProperty('count');
    });
  });
});
