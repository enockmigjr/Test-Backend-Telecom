/* eslint-disable @typescript-eslint/no-explicit-any */
import { Test, TestingModule } from '@nestjs/testing';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { DateRangeDto } from '../../common/dto/date-range.dto';
import { mock, MockProxy } from 'jest-mock-extended';
import { Queue } from 'bullmq';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const mockUser: JwtPayload = {
  sub: 'user-001',
  email: 'supervisor@telecom.local',
  role: 'SUPERVISOR',
  departmentId: 'dept-001',
  jti: 'jti-001',
};

const mockAdmin: JwtPayload = {
  sub: 'admin-001',
  email: 'admin@telecom.local',
  role: 'ADMINISTRATOR',
  departmentId: 'dept-001',
  jti: 'jti-002',
};

const defaultRange: DateRangeDto = {
  from: '2026-01-01T00:00:00Z',
  to: '2026-06-30T23:59:59Z',
};

const slaReportResult = {
  generatedAt: '2026-07-01T12:00:00Z',
  type: 'sla-report',
  period: { from: '2026-01-01T00:00:00Z', to: '2026-06-30T23:59:59Z' },
  summary: { total: 150, breached: 5, avgResolutionMinutes: 360 },
  byPriority: [
    { priority: 'CRITICAL' as const, count: 30, breached: 2 },
    { priority: 'HIGH' as const, count: 40, breached: 3 },
  ],
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('ReportsController', () => {
  let controller: ReportsController;
  let reportsService: MockProxy<ReportsService>;
  let reportQueue: MockProxy<Queue>;

  beforeEach(async () => {
    reportsService = mock<ReportsService>();
    reportQueue = mock<Queue>();
    reportQueue.add.mockResolvedValue({ id: 'job-001', name: 'generate-report', data: {} } as any);

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReportsController],
      providers: [
        { provide: ReportsService, useValue: reportsService },
        { provide: 'BullMQ_Queues', useValue: { report: reportQueue } },
      ],
    }).compile();

    controller = module.get<ReportsController>(ReportsController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  // ticketReport() — POST
  // =========================================================================
  describe('POST /reports/ticket/:id', () => {
    it('doit dispatcher un job de rapport ticket et retourner 202', async () => {
      const result = await controller.ticketReport('ticket-001', mockUser);

      expect(reportQueue.add).toHaveBeenCalledWith('generate-report', {
        type: 'ticket-report',
        data: { ticketId: 'ticket-001', requestedBy: mockUser.sub },
      });
      expect(result).toEqual({
        message: 'Rapport en cours de génération. Vous recevrez une notification.',
        ticketId: 'ticket-001',
      });
    });

    it('doit utiliser le sub du JWT comme requestedBy', async () => {
      await controller.ticketReport('ticket-002', mockAdmin);

      expect(reportQueue.add).toHaveBeenCalledWith('generate-report', {
        type: 'ticket-report',
        data: { ticketId: 'ticket-002', requestedBy: mockAdmin.sub },
      });
    });

    it('doit propager les erreurs de BullMQ', async () => {
      reportQueue.add.mockRejectedValue(new Error('Queue indisponible'));

      await expect(controller.ticketReport('ticket-001', mockUser)).rejects.toThrow('Queue indisponible');
    });
  });

  // =========================================================================
  // slaReport() — GET
  // =========================================================================
  describe('GET /reports/sla', () => {
    it('doit retourner le rapport SLA avec les dates fournies', async () => {
      reportsService.slaReport.mockResolvedValue(slaReportResult);

      const result = await controller.slaReport(defaultRange);

      expect(reportsService.slaReport).toHaveBeenCalledWith(defaultRange.from, defaultRange.to);
      expect(result).toEqual(slaReportResult);
    });

    it('doit appeler le service sans dates (valeurs par défaut)', async () => {
      reportsService.slaReport.mockResolvedValue(slaReportResult);
      const emptyRange: DateRangeDto = {};

      await controller.slaReport(emptyRange);

      expect(reportsService.slaReport).toHaveBeenCalledWith(undefined, undefined);
    });

    it('doit propager les erreurs du service', async () => {
      reportsService.slaReport.mockRejectedValue(new Error('Erreur rapport SLA'));

      await expect(controller.slaReport(defaultRange)).rejects.toThrow('Erreur rapport SLA');
    });
  });

  // =========================================================================
  // slaReportAsync() — POST
  // =========================================================================
  describe('POST /reports/sla', () => {
    it('doit dispatcher un job de rapport SLA et retourner 202', async () => {
      const result = await controller.slaReportAsync(defaultRange, mockUser);

      expect(reportQueue.add).toHaveBeenCalledWith('generate-report', {
        type: 'sla-report',
        data: {
          from: defaultRange.from,
          to: defaultRange.to,
          requestedBy: mockUser.sub,
        },
      });
      expect(result).toEqual({
        message: 'Rapport SLA en cours de génération.',
        period: { from: defaultRange.from, to: defaultRange.to },
      });
    });

    it('doit dispatcher un job avec des dates non définies', async () => {
      const emptyRange: DateRangeDto = {};

      await controller.slaReportAsync(emptyRange, mockUser);

      expect(reportQueue.add).toHaveBeenCalledWith('generate-report', {
        type: 'sla-report',
        data: {
          from: undefined,
          to: undefined,
          requestedBy: mockUser.sub,
        },
      });
    });

    it('doit propager les erreurs de BullMQ', async () => {
      reportQueue.add.mockRejectedValue(new Error('Erreur file'));

      await expect(controller.slaReportAsync(defaultRange, mockUser)).rejects.toThrow('Erreur file');
    });

    it("doit utiliser le sub de l'admin comme requestedBy", async () => {
      await controller.slaReportAsync(defaultRange, mockAdmin);

      expect(reportQueue.add).toHaveBeenCalledWith('generate-report', {
        type: 'sla-report',
        data: {
          from: defaultRange.from,
          to: defaultRange.to,
          requestedBy: mockAdmin.sub,
        },
      });
    });
  });
});
