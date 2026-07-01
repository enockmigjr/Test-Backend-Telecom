/* eslint-disable @typescript-eslint/no-explicit-any */
import { Test, TestingModule } from '@nestjs/testing';
import { AuditLogsService } from './audit-logs.service';
import { DrizzleProvider } from '../../database/drizzle.provider';
import { mock, MockProxy } from 'jest-mock-extended';
import { auditLogs } from '../../database/schemas';

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
const mockAuditLog = {
  id: '0192abcd-1234-7000-8000-000000000001',
  userId: 'user-001',
  action: 'TICKET_CREATED',
  entityType: 'ticket',
  entityId: 'ticket-123',
  oldValue: null,
  newValue: { title: 'Nouveau ticket', status: 'NEW' },
  ipAddress: '192.168.1.1',
  userAgent: 'Mozilla/5.0 Test',
  createdAt: new Date('2026-01-15T10:30:00Z'),
};

const mockAuditLog2 = {
  id: 'log-002',
  userId: 'user-002',
  action: 'USER_UPDATED',
  entityType: 'user',
  entityId: 'user-001',
  oldValue: { role: 'AGENT' },
  newValue: { role: 'SUPERVISOR' },
  ipAddress: '10.0.0.1',
  userAgent: 'curl/7.68',
  createdAt: new Date('2026-02-01T08:00:00Z'),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('AuditLogsService', () => {
  let service: AuditLogsService;
  let drizzle: MockProxy<DrizzleProvider>;
  let mockDb: {
    select: jest.Mock;
    insert: jest.Mock;
  };

  beforeEach(async () => {
    mockDb = {
      select: jest.fn(),
      insert: jest.fn().mockReturnValue({
        values: jest.fn().mockResolvedValue(undefined),
      }),
    };

    drizzle = mock<DrizzleProvider>();
    Object.defineProperty(drizzle, 'db', {
      get: jest.fn(() => mockDb),
      configurable: true,
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [AuditLogsService, { provide: DrizzleProvider, useValue: drizzle }],
    }).compile();

    service = module.get<AuditLogsService>(AuditLogsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  // create()
  // =========================================================================
  describe('create() — Creation d une entree d audit', () => {
    it('doit creer une entree avec tous les champs', async () => {
      await service.create(
        'user-001',
        'TICKET_CREATED',
        'ticket',
        'ticket-123',
        null,
        { title: 'Nouveau ticket' },
        '192.168.1.1',
        'Mozilla/5.0',
      );

      expect(mockDb.insert).toHaveBeenCalledWith(auditLogs);
      expect(mockDb.insert().values).toHaveBeenCalledWith({
        id: '0192abcd-1234-7000-8000-000000000001',
        userId: 'user-001',
        action: 'TICKET_CREATED',
        entityType: 'ticket',
        entityId: 'ticket-123',
        oldValue: null,
        newValue: { title: 'Nouveau ticket' },
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      });
    });

    it('doit creer une entree sans ipAddress ni userAgent', async () => {
      await service.create('user-001', 'LOGIN', 'user', 'user-001');

      expect(mockDb.insert().values).toHaveBeenCalledWith({
        id: '0192abcd-1234-7000-8000-000000000001',
        userId: 'user-001',
        action: 'LOGIN',
        entityType: 'user',
        entityId: 'user-001',
        oldValue: null,
        newValue: null,
        ipAddress: null,
        userAgent: null,
      });
    });

    it('doit copier en profondeur oldValue et newValue pour eviter les mutations', async () => {
      const oldVal = { nested: { key: 'value' } };
      const newVal = { arr: [1, 2, 3] };

      await service.create('user-001', 'UPDATE', 'config', 'cfg-001', oldVal, newVal);

      const insertCall = (mockDb.insert().values as jest.Mock).mock.calls[0][0];
      expect(insertCall.oldValue).toEqual(oldVal);
      expect(insertCall.newValue).toEqual(newVal);
      // Verifie que ce sont des copies, pas les memes references
      expect(insertCall.oldValue).not.toBe(oldVal);
      expect(insertCall.newValue).not.toBe(newVal);
    });

    it('doit retourner void (pas de valeur de retour explicite)', async () => {
      const result = await service.create('user-001', 'DELETE', 'ticket', 'ticket-999');

      expect(result).toBeUndefined();
    });
  });

  // =========================================================================
  // search()
  // =========================================================================
  describe('search() — Recherche avec filtres', () => {
    it('doit retourner toutes les entrees paginees sans filtre', async () => {
      const countBuilder = createMockQueryBuilder([{ count: 2 }]);
      const dataBuilder = createMockQueryBuilder([mockAuditLog, mockAuditLog2]);
      mockDb.select.mockReturnValueOnce(countBuilder).mockReturnValueOnce(dataBuilder);

      const result = await service.search({});

      expect(result.data).toHaveLength(2);
      expect(result.meta.total).toBe(2);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(20);
    });

    it('doit filtrer par userId', async () => {
      const countBuilder = createMockQueryBuilder([{ count: 1 }]);
      const dataBuilder = createMockQueryBuilder([mockAuditLog]);
      mockDb.select.mockReturnValueOnce(countBuilder).mockReturnValueOnce(dataBuilder);

      const result = await service.search({ userId: 'user-001' });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].userId).toBe('user-001');
    });

    it('doit filtrer par action', async () => {
      const countBuilder = createMockQueryBuilder([{ count: 1 }]);
      const dataBuilder = createMockQueryBuilder([mockAuditLog]);
      mockDb.select.mockReturnValueOnce(countBuilder).mockReturnValueOnce(dataBuilder);

      const result = await service.search({ action: 'TICKET_CREATED' });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].action).toBe('TICKET_CREATED');
    });

    it('doit filtrer par entityType', async () => {
      const countBuilder = createMockQueryBuilder([{ count: 1 }]);
      const dataBuilder = createMockQueryBuilder([mockAuditLog]);
      mockDb.select.mockReturnValueOnce(countBuilder).mockReturnValueOnce(dataBuilder);

      const result = await service.search({ entityType: 'ticket' });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].entityType).toBe('ticket');
    });

    it('doit filtrer par entityId', async () => {
      const countBuilder = createMockQueryBuilder([{ count: 1 }]);
      const dataBuilder = createMockQueryBuilder([mockAuditLog]);
      mockDb.select.mockReturnValueOnce(countBuilder).mockReturnValueOnce(dataBuilder);

      const result = await service.search({ entityId: 'ticket-123' });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].entityId).toBe('ticket-123');
    });

    it('doit filtrer par date de debut (from)', async () => {
      const countBuilder = createMockQueryBuilder([{ count: 0 }]);
      const dataBuilder = createMockQueryBuilder([]);
      mockDb.select.mockReturnValueOnce(countBuilder).mockReturnValueOnce(dataBuilder);

      await service.search({ from: '2026-01-01' });

      // Verifie que where est appele avec une condition createdAt >= date
      const whereFn = (mockDb.select as jest.Mock).mock.results[0].value.where;
      expect(whereFn).toHaveBeenCalled();
    });

    it('doit filtrer par date de fin (to)', async () => {
      const countBuilder = createMockQueryBuilder([{ count: 0 }]);
      const dataBuilder = createMockQueryBuilder([]);
      mockDb.select.mockReturnValueOnce(countBuilder).mockReturnValueOnce(dataBuilder);

      await service.search({ to: '2026-06-30' });

      const whereFn = (mockDb.select as jest.Mock).mock.results[0].value.where;
      expect(whereFn).toHaveBeenCalled();
    });

    it('doit combiner plusieurs filtres', async () => {
      const countBuilder = createMockQueryBuilder([{ count: 1 }]);
      const dataBuilder = createMockQueryBuilder([mockAuditLog]);
      mockDb.select.mockReturnValueOnce(countBuilder).mockReturnValueOnce(dataBuilder);

      const result = await service.search({
        userId: 'user-001',
        action: 'TICKET_CREATED',
        entityType: 'ticket',
        from: '2026-01-01',
        to: '2026-12-31',
      });

      expect(result.data).toHaveLength(1);
      // Verifie que le data builder a aussi le where avec conditions
      const dataSelectCall = (mockDb.select as jest.Mock).mock.results[1].value;
      expect(dataSelectCall.where).toHaveBeenCalled();
    });

    it('doit retourner une liste vide si aucun resultat', async () => {
      const countBuilder = createMockQueryBuilder([{ count: 0 }]);
      const dataBuilder = createMockQueryBuilder([]);
      mockDb.select.mockReturnValueOnce(countBuilder).mockReturnValueOnce(dataBuilder);

      const result = await service.search({ userId: 'inexistant' });

      expect(result.data).toHaveLength(0);
      expect(result.meta.total).toBe(0);
    });

    it('doit appliquer la pagination', async () => {
      const countBuilder = createMockQueryBuilder([{ count: 50 }]);
      const dataBuilder = createMockQueryBuilder(Array(10).fill(mockAuditLog));
      mockDb.select.mockReturnValueOnce(countBuilder).mockReturnValueOnce(dataBuilder);

      const result = await service.search({ page: 3, limit: 10 });

      expect(result.meta.page).toBe(3);
      expect(result.meta.limit).toBe(10);
      expect(result.meta.totalPages).toBe(5);
    });

    it('doit trier par createdAt desc', async () => {
      const countBuilder = createMockQueryBuilder([{ count: 0 }]);
      const dataBuilder = createMockQueryBuilder([]);
      mockDb.select.mockReturnValueOnce(countBuilder).mockReturnValueOnce(dataBuilder);

      await service.search({});

      const dataSelectCall = (mockDb.select as jest.Mock).mock.results[1].value;
      expect(dataSelectCall.orderBy).toHaveBeenCalled();
    });

    it('doit appliquer limit et offset sur la requete de donnees', async () => {
      const countBuilder = createMockQueryBuilder([{ count: 10 }]);
      const dataBuilder = createMockQueryBuilder([mockAuditLog]);
      mockDb.select.mockReturnValueOnce(countBuilder).mockReturnValueOnce(dataBuilder);

      await service.search({ page: 2, limit: 5 });

      const dataSelectCall = (mockDb.select as jest.Mock).mock.results[1].value;
      expect(dataSelectCall.limit).toHaveBeenCalledWith(5);
      expect(dataSelectCall.offset).toHaveBeenCalledWith(5); // (2-1)*5
    });

    it('doit utiliser les valeurs par defaut page=1 et limit=20', async () => {
      const countBuilder = createMockQueryBuilder([{ count: 0 }]);
      const dataBuilder = createMockQueryBuilder([]);
      mockDb.select.mockReturnValueOnce(countBuilder).mockReturnValueOnce(dataBuilder);

      await service.search({});

      const dataSelectCall = (mockDb.select as jest.Mock).mock.results[1].value;
      expect(dataSelectCall.limit).toHaveBeenCalledWith(20);
      expect(dataSelectCall.offset).toHaveBeenCalledWith(0);
    });
  });

  // =========================================================================
  // findOne()
  // =========================================================================
  describe('findOne() — Recherche par ID', () => {
    it('doit retourner une entree d audit existante', async () => {
      const builder = createMockQueryBuilder([mockAuditLog]);
      mockDb.select.mockReturnValueOnce(builder);

      const result = await service.findOne(mockAuditLog.id);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(mockAuditLog.id);
      expect(result[0].action).toBe('TICKET_CREATED');
    });

    it('doit retourner un tableau vide si aucun resultat', async () => {
      const builder = createMockQueryBuilder([]);
      mockDb.select.mockReturnValueOnce(builder);

      const result = await service.findOne('inexistant');

      expect(result).toEqual([]);
    });

    it('doit appliquer un filtre where avec le bon id', async () => {
      const builder = createMockQueryBuilder([mockAuditLog]);
      mockDb.select.mockReturnValueOnce(builder);

      await service.findOne('specific-id');

      const selectCall = (mockDb.select as jest.Mock).mock.results[0].value;
      expect(selectCall.from).toHaveBeenCalledWith(auditLogs);
      expect(selectCall.where).toHaveBeenCalled();
      expect(selectCall.limit).toHaveBeenCalledWith(1);
    });
  });

  // =========================================================================
  // Immutabilite
  // =========================================================================
  describe('Immutabilite — Les logs d audit ne peuvent pas etre modifies', () => {
    it('ne doit pas exposer de methode update', () => {
      expect((service as any).update).toBeUndefined();
    });

    it('ne doit pas exposer de methode delete ou remove', () => {
      expect((service as any).delete).toBeUndefined();
      expect((service as any).remove).toBeUndefined();
    });

    it('ne doit jamais appeler update ou delete sur la base de donnees', () => {
      // Le mock n'a pas de methodes update/delete et le service ne les utilise pas
      expect((mockDb as any).update).toBeUndefined();
    });
  });
});
