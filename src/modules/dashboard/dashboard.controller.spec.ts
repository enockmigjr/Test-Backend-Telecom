/**
 * ============================================================================
 * FICHIER : src/modules/dashboard/dashboard.controller.spec.ts
 * RÔLE : Suite de tests unitaires pour le composant dashboard.controller.
 * EXPLICATION :
 * Ce fichier contient les tests automatisés validant le comportement et l'intégrité de dashboard.controller.
 * 1. Vérifie le fonctionnement nominal et les cas d'erreur.
 * 2. Garantit qu'aucune régression n'est introduite lors des évolutions du code.
 * ============================================================================
 */

import { Test, TestingModule } from '@nestjs/testing';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { PublicSupportStatsService } from './public-support-stats.service';
import { DateRangeDto } from '../../common/dto/date-range.dto';
import { mock, MockProxy } from 'jest-mock-extended';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const defaultRange: DateRangeDto = { from: '2026-01-01T00:00:00Z', to: '2026-06-30T23:59:59Z' };
const emptyRange: DateRangeDto = {};

const mockUser: JwtPayload = {
  sub: 'user-001',
  email: 'agent@telecom.local',
  role: 'CUSTOMER_SERVICE_AGENT',
  departmentId: 'dept-001',
  jti: 'jti-001',
};

const overviewResult = {
  period: { from: '2026-01-01T00:00:00Z', to: '2026-06-30T23:59:59Z' },
  ticketVolume: { total: 150, openTickets: 45, resolvedToday: 12, createdToday: 8 },
  byStatus: { NEW: 10, ASSIGNED: 15, IN_PROGRESS: 20, RESOLVED: 80, CLOSED: 25 },
  byPriority: { LOW: 30, MEDIUM: 50, HIGH: 40, CRITICAL: 30 },
  bySeverity: { MINOR: 40, MAJOR: 60, CRITICAL: 50 },
  sla: { totalTracked: 150, breached: 5, atRisk: 3, overdue: 2, compliant: 145, complianceRate: 96.67 },
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
    firstResponseBreached: 3,
    resolutionBreached: 5,
    atRisk: 0,
    overdue: 0,
    complianceRate: 96.67,
    firstResponseComplianceRate: 96.67,
    resolutionComplianceRate: 96.67,
  },
  byPriority: [
    {
      priority: 'HIGH' as const,
      totalTracked: 40,
      compliant: 38,
      breached: 2,
      firstResponseBreached: 1,
      resolutionBreached: 2,
      complianceRate: 95,
      firstResponseComplianceRate: 97.5,
      resolutionComplianceRate: 95,
    },
  ],
  byCategory: [
    {
      category: 'NETWORK',
      totalTracked: 60,
      compliant: 58,
      breached: 2,
      firstResponseBreached: 1,
      resolutionBreached: 2,
      complianceRate: 96.67,
      firstResponseComplianceRate: 98.33,
      resolutionComplianceRate: 96.67,
    },
  ],
  trend: [
    {
      period: '2026-06-01T00:00:00.000Z',
      totalTracked: 50,
      compliant: 48,
      breached: 2,
      firstResponseBreached: 1,
      resolutionBreached: 1,
      complianceRate: 96,
      firstResponseComplianceRate: 98,
      resolutionComplianceRate: 98,
    },
  ],
};

const workloadResult = {
  generatedAt: '2026-06-30T12:00:00Z',
  data: [
    {
      agentId: 'user-001',
      firstName: 'Jean',
      lastName: 'Dupont',
      email: 'jean.dupont@telecom.local',
      openTicketsCount: 10,
      criticalTicketsCount: 2,
      highTicketsCount: 3,
      slaAtRiskCount: 1,
      overdueTicketsCount: 0,
      isAvailable: true,
      absenceEndsAt: null,
      lastActivityAt: '2026-06-30T11:00:00Z',
    },
  ],
  summary: {
    totalAgents: 1,
    totalOpenTickets: 10,
    absentAgentsCount: 0,
    avgTicketsPerAgent: 10.0,
    unassignedTickets: 5,
  },
};

const resolutionTimeResult = {
  period: { from: '2026-01-01T00:00:00Z', to: '2026-06-30T23:59:59Z' },
  overall: {
    avgResolutionTimeMinutes: 360,
    medianResolutionTimeMinutes: 274,
    p90ResolutionTimeMinutes: 925,
    resolvedCount: 0,
  },
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
      providers: [
        { provide: DashboardService, useValue: dashboardService },
        { provide: PublicSupportStatsService, useValue: { overview: jest.fn().mockResolvedValue({}) } },
      ],
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
    /** Test : doit retourner les KPIs globaux avec les dates fournies */
    it('doit retourner les KPIs globaux avec les dates fournies', async () => {
      dashboardService.overview.mockResolvedValue(overviewResult);

      const result = await controller.overview(defaultRange, mockUser);

      expect(dashboardService.overview).toHaveBeenCalledWith(defaultRange.from, defaultRange.to, mockUser);
      expect(result).toEqual(overviewResult);
      expect(result.ticketVolume.total).toBe(150);
      expect(result.sla.complianceRate).toBe(96.67);
    });

    /** Test : doit appeler le service sans dates (valeurs par défaut) */

    it('doit appeler le service sans dates (valeurs par défaut)', async () => {
      dashboardService.overview.mockResolvedValue(overviewResult);

      await controller.overview(emptyRange, mockUser);

      expect(dashboardService.overview).toHaveBeenCalledWith(undefined, undefined, mockUser);
    });

    /** Test : doit propager les erreurs du service */

    it('doit propager les erreurs du service', async () => {
      dashboardService.overview.mockRejectedValue(new Error('Erreur base de données'));

      await expect(controller.overview(defaultRange, mockUser)).rejects.toThrow('Erreur base de données');
    });
  });

  // =========================================================================
  // ticketsByStatus()
  // =========================================================================
  describe('GET /dashboard/tickets-by-status', () => {
    /** Test : doit retourner la répartition par statut sans filtre département */
    it('doit retourner la répartition par statut sans filtre département', async () => {
      dashboardService.ticketsByStatus.mockResolvedValue(ticketsByStatusResult);

      const result = await controller.ticketsByStatus(defaultRange, mockUser, undefined);

      expect(dashboardService.ticketsByStatus).toHaveBeenCalledWith(
        defaultRange.from,
        defaultRange.to,
        undefined,
        mockUser,
      );
      expect(result).toEqual(ticketsByStatusResult);
    });

    /** Test : doit filtrer par département quand departmentId est fourni */

    it('doit filtrer par département quand departmentId est fourni', async () => {
      dashboardService.ticketsByStatus.mockResolvedValue(ticketsByStatusResult);

      await controller.ticketsByStatus(defaultRange, mockUser, 'dept-002');

      expect(dashboardService.ticketsByStatus).toHaveBeenCalledWith(
        defaultRange.from,
        defaultRange.to,
        'dept-002',
        mockUser,
      );
    });

    /** Test : doit propager les erreurs du service */

    it('doit propager les erreurs du service', async () => {
      dashboardService.ticketsByStatus.mockRejectedValue(new Error('Erreur requête'));

      await expect(controller.ticketsByStatus(defaultRange, mockUser, undefined)).rejects.toThrow('Erreur requête');
    });
  });

  // =========================================================================
  // ticketsByPriority()
  // =========================================================================
  describe('GET /dashboard/tickets-by-priority', () => {
    /** Test : doit retourner la répartition par priorité sans filtre statut */
    it('doit retourner la répartition par priorité sans filtre statut', async () => {
      dashboardService.ticketsByPriority.mockResolvedValue(ticketsByPriorityResult);

      const result = await controller.ticketsByPriority(defaultRange, mockUser, undefined);

      expect(dashboardService.ticketsByPriority).toHaveBeenCalledWith(
        defaultRange.from,
        defaultRange.to,
        undefined,
        mockUser,
      );
      expect(result).toEqual(ticketsByPriorityResult);
    });

    /** Test : doit filtrer par statut OPEN */

    it('doit filtrer par statut OPEN', async () => {
      dashboardService.ticketsByPriority.mockResolvedValue(ticketsByPriorityResult);

      await controller.ticketsByPriority(defaultRange, mockUser, 'OPEN');

      expect(dashboardService.ticketsByPriority).toHaveBeenCalledWith(
        defaultRange.from,
        defaultRange.to,
        'OPEN',
        mockUser,
      );
    });

    /** Test : doit filtrer par statut RESOLVED */

    it('doit filtrer par statut RESOLVED', async () => {
      dashboardService.ticketsByPriority.mockResolvedValue(ticketsByPriorityResult);

      await controller.ticketsByPriority(defaultRange, mockUser, 'RESOLVED');

      expect(dashboardService.ticketsByPriority).toHaveBeenCalledWith(
        defaultRange.from,
        defaultRange.to,
        'RESOLVED',
        mockUser,
      );
    });
  });

  // =========================================================================
  // departments()
  // =========================================================================
  describe('GET /dashboard/departments', () => {
    /** Test : doit retourner la performance par département avec les dates */
    it('doit retourner la performance par département avec les dates', async () => {
      dashboardService.departmentsReport.mockResolvedValue(departmentsResult);

      const result = await controller.departments(defaultRange, mockUser);

      expect(dashboardService.departmentsReport).toHaveBeenCalledWith(defaultRange.from, defaultRange.to, mockUser);
      expect(result).toEqual(departmentsResult);
    });

    /** Test : doit appeler le service sans dates */

    it('doit appeler le service sans dates', async () => {
      dashboardService.departmentsReport.mockResolvedValue(departmentsResult);

      await controller.departments(emptyRange, mockUser);

      expect(dashboardService.departmentsReport).toHaveBeenCalledWith(undefined, undefined, mockUser);
    });
  });

  // =========================================================================
  // slaCompliance()
  // =========================================================================
  describe('GET /dashboard/sla-compliance', () => {
    /** Test : doit retourner la conformité SLA sans filtres supplémentaires */
    it('doit retourner la conformité SLA sans filtres supplémentaires', async () => {
      dashboardService.slaCompliance.mockResolvedValue(slaComplianceResult);

      const result = await controller.slaCompliance(defaultRange, mockUser, undefined, undefined, undefined);

      expect(dashboardService.slaCompliance).toHaveBeenCalledWith(
        defaultRange.from,
        defaultRange.to,
        undefined,
        undefined,
        undefined,
        mockUser,
      );
      expect(result).toEqual(slaComplianceResult);
    });

    /** Test : doit filtrer par département, priorité et catégorie */

    it('doit filtrer par département, priorité et catégorie', async () => {
      dashboardService.slaCompliance.mockResolvedValue(slaComplianceResult);

      await controller.slaCompliance(defaultRange, mockUser, 'dept-001', 'HIGH', 'NETWORK');

      expect(dashboardService.slaCompliance).toHaveBeenCalledWith(
        defaultRange.from,
        defaultRange.to,
        'dept-001',
        'HIGH',
        'NETWORK',
        mockUser,
      );
    });
  });

  // =========================================================================
  // workload()
  // =========================================================================
  describe('GET /dashboard/workload', () => {
    /** Test : doit retourner la charge des agents sans filtre département */
    it('doit retourner la charge des agents sans filtre département', async () => {
      dashboardService.workload.mockResolvedValue(workloadResult);

      const result = await controller.workload(mockUser, undefined);

      expect(dashboardService.workload).toHaveBeenCalledWith(undefined, mockUser);
      expect(result).toEqual(workloadResult);
    });

    /** Test : doit filtrer la charge par département */

    it('doit filtrer la charge par département', async () => {
      dashboardService.workload.mockResolvedValue(workloadResult);

      await controller.workload(mockUser, 'dept-003');

      expect(dashboardService.workload).toHaveBeenCalledWith('dept-003', mockUser);
    });
  });

  // =========================================================================
  // resolutionTime()
  // =========================================================================
  describe('GET /dashboard/resolution-time', () => {
    /** Test : doit retourner les statistiques de temps de résolution */
    it('doit retourner les statistiques de temps de résolution', async () => {
      dashboardService.resolutionTime.mockResolvedValue(resolutionTimeResult);

      const result = await controller.resolutionTime(defaultRange, mockUser, undefined, undefined, undefined);

      expect(dashboardService.resolutionTime).toHaveBeenCalledWith(
        defaultRange.from,
        defaultRange.to,
        undefined,
        undefined,
        undefined,
        mockUser,
      );
      expect(result).toEqual(resolutionTimeResult);
    });

    /** Test : doit appliquer les filtres groupBy, departmentId et priority */

    it('doit appliquer les filtres groupBy, departmentId et priority', async () => {
      dashboardService.resolutionTime.mockResolvedValue(resolutionTimeResult);

      await controller.resolutionTime(defaultRange, mockUser, 'week', 'dept-001', 'CRITICAL');

      expect(dashboardService.resolutionTime).toHaveBeenCalledWith(
        defaultRange.from,
        defaultRange.to,
        'week',
        'dept-001',
        'CRITICAL',
        mockUser,
      );
    });

    /** Test : doit propager les erreurs du service */

    it('doit propager les erreurs du service', async () => {
      dashboardService.resolutionTime.mockRejectedValue(new Error('Erreur statistiques'));

      await expect(controller.resolutionTime(defaultRange, mockUser, undefined, undefined, undefined)).rejects.toThrow(
        'Erreur statistiques',
      );
    });
  });
});
