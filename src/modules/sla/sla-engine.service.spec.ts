import { Test, TestingModule } from '@nestjs/testing';
import { DrizzleProvider } from '../../database/drizzle.provider';

/**
 * Mocks manuels pour les importations.
 * Les schemas Drizzle ne sont pas inclus dans le scope de test unitaire
 * (ils nécessitent une connexion PostgreSQL réelle).
 */
jest.mock('../../database/schemas/tickets', () => ({
  tickets: {
    id: 'tickets.id',
    ticketNumber: 'tickets.ticket_number',
    status: 'tickets.status',
    resolutionDueAt: 'tickets.resolution_due_at',
    slaBreached: 'tickets.sla_breached',
  },
}));

jest.mock('@nestjs/schedule', () => ({
  Cron: () => jest.fn(),
}));

/**
 * Mock de drizzle-orm pour les operateurs utilises par SlaEngineService.
 */
jest.mock('drizzle-orm', () => {
  const actual = jest.requireActual('drizzle-orm');
  return {
    ...actual,
    and: jest.fn((...args: unknown[]) => args),
    lt: jest.fn((a: unknown, b: unknown) => ({ op: 'lt', a, b })),
    gte: jest.fn((a: unknown, b: unknown) => ({ op: 'gte', a, b })),
    eq: jest.fn((a: unknown, b: unknown) => ({ op: 'eq', a, b })),
    notInArray: jest.fn((a: unknown, b: unknown[]) => ({ op: 'notInArray', a, b })),
  };
});

describe('SlaEngineService', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let service: any; // Utiliser any pour contourner les problèmes de typage des modules mockés
  let mockSelectQuery: { from: jest.Mock; where: jest.Mock; limit: jest.Mock };
  let mockUpdateQuery: { set: jest.Mock; where: jest.Mock };
  let mockDb: { select: jest.Mock; update: jest.Mock };

  beforeEach(async () => {
    mockSelectQuery = {
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue([]),
    };

    mockUpdateQuery = {
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockResolvedValue(undefined),
    };

    mockDb = {
      select: jest.fn().mockReturnValue(mockSelectQuery),
      update: jest.fn().mockReturnValue(mockUpdateQuery),
    };

    const drizzle = { db: mockDb } as unknown as DrizzleProvider;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: DrizzleProvider,
          useValue: drizzle,
        },
      ],
    }).compile();

    // Utiliser evaluate() pour instancier SlaEngineService manuellement
    // car le mock de @nestjs/schedule @Cron peut causer des erreurs d'heritage
    const { SlaEngineService } = jest.requireActual('./sla-engine.service');
    service = new SlaEngineService(drizzle);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('calculateDueDate() — Calcul de la date d\'echeance SLA', () => {
    it('doit retourner createdAt + resolutionMinutes pour un calcul simple', () => {
      const createdAt = new Date('2026-06-26T10:00:00Z');
      const resolutionMinutes = 120; // 2 heures

      const dueDate = service.calculateDueDate(createdAt, resolutionMinutes);

      expect(dueDate.toISOString()).toBe('2026-06-26T12:00:00.000Z');
    });

    it('doit retourner createdAt + 0 pour resolutionMinutes = 0', () => {
      const createdAt = new Date('2026-06-26T10:00:00Z');

      const dueDate = service.calculateDueDate(createdAt, 0);

      expect(dueDate.toISOString()).toBe(createdAt.toISOString());
    });

    it('doit fonctionner avec de grandes valeurs (24h = 1440 minutes)', () => {
      const createdAt = new Date('2026-06-26T10:00:00Z');

      const dueDate = service.calculateDueDate(createdAt, 1440);

      expect(dueDate.toISOString()).toBe('2026-06-27T10:00:00.000Z');
    });

    it('doit retourner une nouvelle instance Date (pas la meme reference)', () => {
      const createdAt = new Date('2026-06-26T10:00:00Z');

      const dueDate = service.calculateDueDate(createdAt, 60);

      expect(dueDate).not.toBe(createdAt);
      expect(dueDate.getTime()).toBe(createdAt.getTime() + 3600000);
    });
  });

  describe('checkSla() — Verification periodique des SLA', () => {
    it('ne doit pas planter quand aucun ticket n\'est en breach ni en warning', async () => {
      await expect(service.checkSla()).resolves.toBeUndefined();
    });

    it('doit marquer les tickets en breach comme slaBreached = true', async () => {
      const breachedTicket = { id: 'ticket-1', ticketNumber: 'TKT-001' };

      // Premier appel .limit() = requete des tickets en breach
      mockSelectQuery.limit
        .mockResolvedValueOnce([breachedTicket])  // breached tickets
        .mockResolvedValueOnce([]);               // warning tickets

      await service.checkSla();

      // Verifier que update a ete appele pour marquer le breach
      expect(mockUpdateQuery.set).toHaveBeenCalledWith({ slaBreached: true });
      expect(mockUpdateQuery.where).toHaveBeenCalled();
    });

    it('doit traiter plusieurs tickets en breach simultanement', async () => {
      const breachedTickets = [
        { id: 'ticket-1', ticketNumber: 'TKT-001' },
        { id: 'ticket-2', ticketNumber: 'TKT-002' },
      ];

      mockSelectQuery.limit
        .mockResolvedValueOnce(breachedTickets)  // breached tickets
        .mockResolvedValueOnce([]);               // warning tickets

      await service.checkSla();

      // Doit avoir marque chaque ticket comme breached
      expect(mockUpdateQuery.set).toHaveBeenCalledTimes(2);
    });

    it('doit fonctionner sans breach ni warning', async () => {
      mockSelectQuery.limit
        .mockResolvedValueOnce([])  // aucun breach
        .mockResolvedValueOnce([]); // aucun warning

      await expect(service.checkSla()).resolves.toBeUndefined();

      expect(mockUpdateQuery.set).not.toHaveBeenCalled();
    });
  });
});
