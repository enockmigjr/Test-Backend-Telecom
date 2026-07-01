/* eslint-disable @typescript-eslint/no-explicit-any */
import { Test, TestingModule } from '@nestjs/testing';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { DateRangeDto } from '../../common/dto/date-range.dto';
import { mock, MockProxy } from 'jest-mock-extended';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const defaultRange: DateRangeDto = { from: '2026-01-01T00:00:00Z', to: '2026-06-30T23:59:59Z' };
const emptyRange: DateRangeDto = {};

const overviewResult = {
  period: { from: '2026-01-01T00:00:00Z', to: '2026-06-30T23:59:59Z' },
  ticketVolume: { total: 150, openTickets: 45, resolvedToday: 12, createdToday: 8 },
  byStatus: { NEW: 10, ASSIGNED: 15, IN_PROGRESS: 20, RESOLVED: 80, CLOSED: 25 },
  byPriority: { LOW: 30, MEDIUM: 50, HIGH: 40, CRITICAL: 30 },
  bySeverity: { MINOR: 40, MAJOR: 60, CRITICAL: 50 },
  sla: { totalTracked: 150, breached: 5, atRisk: 3, compliant: 145, complianceRate: 96.67 },
};

const ticketsByStatusResult = {
  period: { from: '2026-01-01T00:00:00Z', to: '2026-06-30T23:59:59Z' },
  data: [
    { status: 'NEW' as const, count: 10, avgAgeMinutes: 120, percentage: 6.67 },
    { status: 'RESOLVED' as const, count: 80, avgAgeMinutes: 480, percentage: 53.33 },
  ],
};

const ticketsByPriorityResult = {
  period: { from: '2026-01-01T00:00:00Z', to: '2026-06-30T23:59:59Z' },
  data: [
    { priority: 'HIGH' as const, count: 40, slaBreaches: 3, percentage: 26.67 },
    { priority: 'CRITICAL' as const, count: 30, slaBreaches: 2, percentage: 20.0 },
  ],
};

const departmentsResult = {
  period: { from: '2026-01-01T00:00:00Z', to: '2026-06-30T23:59:59Z' },
  data: [
    {
      departmentId: 'dept-001',
      departmentName: 'Support Technique',
      total: 80,
      open: 20,
      resolved: 50,
      closed: 10,
      slaCompliant: 75,
      slaBreached: 5,
      avgResolutionMinutes: 360,
    },
  ],
};

const slaComplianceResult = {
  period: { from: '2026-01-01T00:00:00Z', to: '2026-06-30T23:59:59Z' },
  summary: {
    totalTracked: 150,
    compliant: 145,
    breached: 5,
    atRisk: 0,
    complianceRate: 96.67,
    firstResponseComplianceRate: 96.67,
  },
  byPriority: [{ priority: 'HIGH' as const, totalTracked: 40, compliant: 38, breached: 2, complianceRate: 95.0 }],
  byCategory: [{ category: 'NETWORK' as const, totalTracked: 60, compliant: 58, breached: 2, complianceRate: 96.67 }],
};

const workloadResult = {
  generatedAt: '2026-06-30T12:00:00Z',
  data: [{ assignedTo: 'user-001', total: 10, critical: 2, high: 3, slaAtRisk: 1 }],
  summary: { totalAgents: 1, totalOpenTickets: 10, avgTicketsPerAgent: 10.0, unassignedTickets: 5 },
};

const resolutionTimeResult = {
  period: { from: '2026-01-01T00:00:00Z', to: '2026-06-30T23:59:59Z' },
  overall: { avgResolutionTimeMinutes: 360, medianResolutionTimeMinutes: 274, p90ResolutionTimeMinutes: 925 },
  trend: [],
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('DashboardController', () => {
  let controller: DashboardController;
  let dashboardService: MockProxy<DashboardService>;

  beforeEach(async () => {
    dashboardService = mock<DashboardService>();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DashboardController],
      providers: [{ provide: DashboardService, useValue: dashboardService }],
    }).compile();

    controller = module.get<DashboardController>(DashboardController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  // overview()
  // =========================================================================
  describe('GET /dashboard/overview', () => {
    it('doit retourner les KPIs globaux avec les dates fournies', async () => {
      dashboardService.overview.mockResolvedValue(overviewResult);

      const result = await controller.overview(defaultRange);

      expect(dashboardService.overview).toHaveBeenCalledWith(defaultRange.from, defaultRange.to);
      expect(result).toEqual(overviewResult);
      expect(result.ticketVolume.total).toBe(150);
      expect(result.sla.complianceRate).toBe(96.67);
    });

    it('doit appeler le service sans dates (valeurs par défaut)', async () => {
      dashboardService.overview.mockResolvedValue(overviewResult);

      await controller.overview(emptyRange);

      expect(dashboardService.overview).toHaveBeenCalledWith(undefined, undefined);
    });

    it('doit propager les erreurs du service', async () => {
      dashboardService.overview.mockRejectedValue(new Error('Erreur base de données'));

      await expect(controller.overview(defaultRange)).rejects.toThrow('Erreur base de données');
    });
  });

  // =========================================================================
  // ticketsByStatus()
  // =========================================================================
  describe('GET /dashboard/tickets-by-status', () => {
    it('doit retourner la répartition par statut sans filtre département', async () => {
      dashboardService.ticketsByStatus.mockResolvedValue(ticketsByStatusResult);

      const result = await controller.ticketsByStatus(defaultRange, undefined);

      expect(dashboardService.ticketsByStatus).toHaveBeenCalledWith(defaultRange.from, defaultRange.to, undefined);
      expect(result).toEqual(ticketsByStatusResult);
    });

    it('doit filtrer par département quand departmentId est fourni', async () => {
      dashboardService.ticketsByStatus.mockResolvedValue(ticketsByStatusResult);

      await controller.ticketsByStatus(defaultRange, 'dept-002');

      expect(dashboardService.ticketsByStatus).toHaveBeenCalledWith(defaultRange.from, defaultRange.to, 'dept-002');
    });

    it('doit propager les erreurs du service', async () => {
      dashboardService.ticketsByStatus.mockRejectedValue(new Error('Erreur requête'));

      await expect(controller.ticketsByStatus(defaultRange, undefined)).rejects.toThrow('Erreur requête');
    });
  });

  // =========================================================================
  // ticketsByPriority()
  // =========================================================================
  describe('GET /dashboard/tickets-by-priority', () => {
    it('doit retourner la répartition par priorité sans filtre statut', async () => {
      dashboardService.ticketsByPriority.mockResolvedValue(ticketsByPriorityResult);

      const result = await controller.ticketsByPriority(defaultRange, undefined);

      expect(dashboardService.ticketsByPriority).toHaveBeenCalledWith(defaultRange.from, defaultRange.to, undefined);
      expect(result).toEqual(ticketsByPriorityResult);
    });

    it('doit filtrer par statut OPEN', async () => {
      dashboardService.ticketsByPriority.mockResolvedValue(ticketsByPriorityResult);

      await controller.ticketsByPriority(defaultRange, 'OPEN');

      expect(dashboardService.ticketsByPriority).toHaveBeenCalledWith(defaultRange.from, defaultRange.to, 'OPEN');
    });

    it('doit filtrer par statut RESOLVED', async () => {
      dashboardService.ticketsByPriority.mockResolvedValue(ticketsByPriorityResult);

      await controller.ticketsByPriority(defaultRange, 'RESOLVED');

      expect(dashboardService.ticketsByPriority).toHaveBeenCalledWith(defaultRange.from, defaultRange.to, 'RESOLVED');
    });
  });

  // =========================================================================
  // departments()
  // =========================================================================
  describe('GET /dashboard/departments', () => {
    it('doit retourner la performance par département avec les dates', async () => {
      dashboardService.departmentsReport.mockResolvedValue(departmentsResult);

      const result = await controller.departments(defaultRange);

      expect(dashboardService.departmentsReport).toHaveBeenCalledWith(defaultRange.from, defaultRange.to);
      expect(result).toEqual(departmentsResult);
    });

    it('doit appeler le service sans dates', async () => {
      dashboardService.departmentsReport.mockResolvedValue(departmentsResult);

      await controller.departments(emptyRange);

      expect(dashboardService.departmentsReport).toHaveBeenCalledWith(undefined, undefined);
    });
  });

  // =========================================================================
  // slaCompliance()
  // =========================================================================
  describe('GET /dashboard/sla-compliance', () => {
    it('doit retourner la conformité SLA sans filtres supplémentaires', async () => {
      dashboardService.slaCompliance.mockResolvedValue(slaComplianceResult);

      const result = await controller.slaCompliance(defaultRange, undefined, undefined, undefined);

      expect(dashboardService.slaCompliance).toHaveBeenCalledWith(
        defaultRange.from,
        defaultRange.to,
        undefined,
        undefined,
        undefined,
      );
      expect(result).toEqual(slaComplianceResult);
    });

    it('doit filtrer par département, priorité et catégorie', async () => {
      dashboardService.slaCompliance.mockResolvedValue(slaComplianceResult);

      await controller.slaCompliance(defaultRange, 'dept-001', 'HIGH', 'NETWORK');

      expect(dashboardService.slaCompliance).toHaveBeenCalledWith(
        defaultRange.from,
        defaultRange.to,
        'dept-001',
        'HIGH',
        'NETWORK',
      );
    });
  });

  // =========================================================================
  // workload()
  // =========================================================================
  describe('GET /dashboard/workload', () => {
    it('doit retourner la charge des agents sans filtre département', async () => {
      dashboardService.workload.mockResolvedValue(workloadResult);

      const result = await controller.workload(undefined);

      expect(dashboardService.workload).toHaveBeenCalledWith(undefined);
      expect(result).toEqual(workloadResult);
    });

    it('doit filtrer la charge par département', async () => {
      dashboardService.workload.mockResolvedValue(workloadResult);

      await controller.workload('dept-003');

      expect(dashboardService.workload).toHaveBeenCalledWith('dept-003');
    });
  });

  // =========================================================================
  // resolutionTime()
  // =========================================================================
  describe('GET /dashboard/resolution-time', () => {
    it('doit retourner les statistiques de temps de résolution', async () => {
      dashboardService.resolutionTime.mockResolvedValue(resolutionTimeResult);

      const result = await controller.resolutionTime(defaultRange, undefined, undefined, undefined);

      expect(dashboardService.resolutionTime).toHaveBeenCalledWith(
        defaultRange.from,
        defaultRange.to,
        undefined,
        undefined,
        undefined,
      );
      expect(result).toEqual(resolutionTimeResult);
    });

    it('doit appliquer les filtres groupBy, departmentId et priority', async () => {
      dashboardService.resolutionTime.mockResolvedValue(resolutionTimeResult);

      await controller.resolutionTime(defaultRange, 'week', 'dept-001', 'CRITICAL');

      expect(dashboardService.resolutionTime).toHaveBeenCalledWith(
        defaultRange.from,
        defaultRange.to,
        'week',
        'dept-001',
        'CRITICAL',
      );
    });

    it('doit propager les erreurs du service', async () => {
      dashboardService.resolutionTime.mockRejectedValue(new Error('Erreur statistiques'));

      await expect(controller.resolutionTime(defaultRange, undefined, undefined, undefined)).rejects.toThrow(
        'Erreur statistiques',
      );
    });
  });
});
