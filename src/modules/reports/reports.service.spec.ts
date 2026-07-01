/* eslint-disable @typescript-eslint/no-explicit-any */
import { Test, TestingModule } from '@nestjs/testing';
import { ReportsService } from './reports.service';
import { DrizzleProvider } from '../../database/drizzle.provider';
import { mock, MockProxy } from 'jest-mock-extended';

// ---------------------------------------------------------------------------
// Mocks pdfkit
// ---------------------------------------------------------------------------
jest.mock('pdfkit', () => {
  // Fausse accumulation de donnees — le mock ecrit un petit en-tete
  // pour simuler le comportement du vrai PDFDocument.
  const chunks: Buffer[] = [];
  let writableRef: any = null;

  const mockDoc = {
    pipe: jest.fn().mockImplementation(function (this: any, stream: any) {
      writableRef = stream;
      chunks.push(Buffer.from('%PDF-1.4 mock\n'));
      return this;
    }),
    fontSize: jest.fn().mockReturnThis(),
    font: jest.fn().mockReturnThis(),
    text: jest.fn().mockImplementation(function (this: any, _text: string) {
      chunks.push(Buffer.from(`BT /F1 12 Tf (${_text}) Tj ET\n`));
      return this;
    }),
    moveDown: jest.fn().mockReturnThis(),
    end: jest.fn().mockImplementation(function (this: any) {
      chunks.push(Buffer.from('%%EOF\n'));
      if (writableRef) {
        // Ecrire tous les chunks accumules dans le flux avant de le fermer
        for (const c of chunks) {
          writableRef.write(c);
        }
        writableRef.end();
      }
      return this;
    }),
    page: { width: 595.28 },
  };
  const MockPDFDocument = function () {
    return mockDoc;
  };
  // __esModule + default force __importStar a retourner la fonction directement
  (MockPDFDocument as any).__esModule = true;
  (MockPDFDocument as any).default = MockPDFDocument;
  return MockPDFDocument;
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const mockTicket = {
  id: 'ticket-001',
  ticketNumber: 'TICKET-2026-0001',
  title: 'Panne réseau fibre',
  description: 'Perte de connectivité fibre optique',
  status: 'RESOLVED',
  priority: 'HIGH',
  severity: 'MAJOR',
  category: 'NETWORK',
  createdAt: new Date('2026-01-15T10:00:00Z'),
  resolvedAt: new Date('2026-01-15T14:30:00Z'),
  closedAt: null,
  customerName: 'Client A',
  resolutionSummary: 'Fibre reconnectée',
  departmentName: 'Support Technique',
};

const byPriorityData = [
  { priority: 'CRITICAL', count: 30, breached: 2 },
  { priority: 'HIGH', count: 40, breached: 3 },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('ReportsService', () => {
  let service: ReportsService;
  let drizzle: MockProxy<DrizzleProvider>;

  // Query builders mocks
  let mockSelectQuery: {
    from: jest.Mock;
    where: jest.Mock;
    limit: jest.Mock;
    leftJoin: jest.Mock;
    groupBy: jest.Mock;
  };

  beforeEach(async () => {
    mockSelectQuery = {
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue([]),
      leftJoin: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockResolvedValue([]),
    };

    const mockDb = {
      select: jest.fn().mockReturnValue(mockSelectQuery),
    };

    drizzle = mock<DrizzleProvider>();
    Object.defineProperty(drizzle, 'db', {
      get: jest.fn(() => mockDb),
      configurable: true,
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [ReportsService, { provide: DrizzleProvider, useValue: drizzle }],
    }).compile();

    service = module.get<ReportsService>(ReportsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  // ticketReport()
  // =========================================================================
  describe("ticketReport() — Rapport détaillé d'un ticket", () => {
    it("doit retourner les données d'un ticket existant", async () => {
      mockSelectQuery.limit.mockResolvedValueOnce([mockTicket]);

      const result = await service.ticketReport('ticket-001');

      expect(result).toBeDefined();
      expect(result.type).toBe('ticket-report');
      expect(result.ticket).toBeDefined();
      expect(result.ticket.id).toBe('ticket-001');
      expect(result.ticket.ticketNumber).toBe('TICKET-2026-0001');
      expect(result.ticket.title).toBe('Panne réseau fibre');
      expect(result.ticket.departmentName).toBe('Support Technique');
      expect(result.generatedAt).toBeDefined();
    });

    it("doit lever une erreur si le ticket n'existe pas", async () => {
      mockSelectQuery.limit.mockResolvedValueOnce([]);

      await expect(service.ticketReport('ticket-inexistant')).rejects.toThrow('Ticket non trouvé');
    });

    it('doit lever une erreur si le ticket est soft-deleté', async () => {
      mockSelectQuery.limit.mockResolvedValueOnce([]);

      await expect(service.ticketReport('ticket-supprime')).rejects.toThrow('Ticket non trouvé');
    });

    it('doit faire une jointure avec la table departments', async () => {
      mockSelectQuery.limit.mockResolvedValueOnce([mockTicket]);

      await service.ticketReport('ticket-001');

      expect(mockSelectQuery.leftJoin).toHaveBeenCalled();
      expect(mockSelectQuery.from).toHaveBeenCalled();
      expect(mockSelectQuery.where).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // slaReport()
  // =========================================================================
  describe('slaReport() — Rapport SLA sur une période', () => {
    it('doit retourner le rapport SLA avec les dates fournies', async () => {
      // slaReport fait DEUX requêtes :
      //   1. select(...).from(tickets).where(where)              → PAS de .limit()
      //   2. select(...).from(tickets).where(where).groupBy(...)
      //
      // La première requête se termine par .where() : on utilise mockReturnValueOnce
      // pour que le premier appel à .where() retourne une Promise résolue.
      // Le second appel à .where() retourne mockSelectQuery pour permettre .groupBy().
      mockSelectQuery.where = jest
        .fn()
        .mockReturnValueOnce(Promise.resolve([{ total: 150, breached: 5, avgResolutionMinutes: 360 }]))
        .mockReturnValue(mockSelectQuery);
      mockSelectQuery.groupBy = jest.fn().mockResolvedValue(byPriorityData);

      const result = await service.slaReport('2026-01-01T00:00:00Z', '2026-06-30T23:59:59Z');

      expect(result).toBeDefined();
      expect(result.type).toBe('sla-report');
      expect(result.summary.total).toBe(150);
      expect(result.summary.breached).toBe(5);
      expect(result.byPriority).toHaveLength(2);
    });

    it('doit utiliser les dates par défaut si non fournies', async () => {
      mockSelectQuery.where = jest
        .fn()
        .mockReturnValueOnce(Promise.resolve([{ total: 0, breached: 0, avgResolutionMinutes: 0 }]))
        .mockReturnValue(mockSelectQuery);
      mockSelectQuery.groupBy = jest.fn().mockResolvedValue([]);

      const result = await service.slaReport(undefined, undefined);

      expect(result).toBeDefined();
      expect(result.period.from).toBeDefined();
      expect(result.period.to).toBeDefined();
    });

    it('doit retourner un résumé avec des zéros si aucun ticket', async () => {
      mockSelectQuery.where = jest
        .fn()
        .mockReturnValueOnce(Promise.resolve([{ total: 0, breached: 0, avgResolutionMinutes: 0 }]))
        .mockReturnValue(mockSelectQuery);
      mockSelectQuery.groupBy = jest.fn().mockResolvedValue([]);

      const result = await service.slaReport('2026-01-01T00:00:00Z', '2026-06-30T23:59:59Z');

      expect(result.summary.total).toBe(0);
      expect(result.summary.breached).toBe(0);
      expect(result.summary.avgResolutionMinutes).toBe(0);
      expect(result.byPriority).toHaveLength(0);
    });
  });

  // =========================================================================
  // generatePdf()
  // =========================================================================
  describe('generatePdf() — Génération PDF', () => {
    it('doit générer un buffer PDF avec un titre et des données', async () => {
      const reportData = {
        title: 'Rapport SLA - Juin 2026',
        headers: ['Priorité', 'Total', 'Violations'],
        rows: [
          ['CRITICAL', '30', '2'],
          ['HIGH', '40', '3'],
        ],
      };

      const result = await service.generatePdf(reportData);

      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(0);
    });

    it('doit générer un PDF avec un seul enregistrement', async () => {
      const reportData = {
        title: 'Rapport Ticket',
        headers: ['ID', 'Titre'],
        rows: [['ticket-001', 'Panne réseau']],
      };

      const result = await service.generatePdf(reportData);

      expect(result).toBeInstanceOf(Buffer);
    });

    it('doit générer un PDF avec des données vides (uniquement en-têtes)', async () => {
      const reportData = {
        title: 'Rapport Vide',
        headers: ['Colonne 1', 'Colonne 2'],
        rows: [],
      };

      const result = await service.generatePdf(reportData);

      expect(result).toBeInstanceOf(Buffer);
    });

    it('doit retourner un buffer même avec un jeu de données minimal', async () => {
      const reportData = {
        title: 'Test',
        headers: ['A'],
        rows: [['1']],
      };

      const result = await service.generatePdf(reportData);
      expect(Buffer.isBuffer(result)).toBe(true);
    });
  });
});
