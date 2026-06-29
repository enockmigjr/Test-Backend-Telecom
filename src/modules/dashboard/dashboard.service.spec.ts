import { DashboardService } from './dashboard.service';
import { DrizzleProvider } from '../../database/drizzle.provider';

/**
 * Tests du service dashboard.
 * Mocke Drizzle pour tester les agrégations sans DB.
 */
describe('DashboardService', () => {
  let service: DashboardService;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockDrizzle: any;

  beforeEach(() => {
    const mockChain = {
      select: () => mockChain,
      from: () => mockChain,
      leftJoin: () => mockChain,
      where: () => mockChain,
      orderBy: () => mockChain,
      limit: () => mockChain,
      offset: () => mockChain,
      groupBy: () => Promise.resolve([]),
    };

    mockDrizzle = { db: mockChain };
    service = new DashboardService(mockDrizzle as DrizzleProvider);
  });

  it('workload doit retourner la structure attendue', async () => {
    const result = await service.workload();
    expect(result).toBeDefined();
    expect(result.summary).toBeDefined();
    expect(result.generatedAt).toBeDefined();
  });

  it('ticketsByStatus doit retourner période et data', async () => {
    const result = await service.ticketsByStatus();
    expect(result).toBeDefined();
    expect(result.period).toBeDefined();
    expect(result.data).toEqual([]);
  });

  it('ticketsByPriority doit retourner période et data', async () => {
    const result = await service.ticketsByPriority();
    expect(result).toBeDefined();
    expect(result.period).toBeDefined();
    expect(result.data).toEqual([]);
  });

  it('departmentsReport doit définir le service', () => {
    expect(service).toBeDefined();
  });
});
