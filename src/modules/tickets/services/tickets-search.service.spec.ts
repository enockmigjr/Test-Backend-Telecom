/* eslint-disable @typescript-eslint/no-explicit-any */
import { TicketsSearchService } from './tickets-search.service';
import { DrizzleProvider } from '../../../database/drizzle.provider';

/**
 * Tests du service de recherche de tickets.
 * Le mock Drizzle doit être thenable pour gérer `await chain.where()`.
 */
describe('TicketsSearchService', () => {
  let service: TicketsSearchService;
  let mockDrizzle: any;

  function mockThenable(returnValue: any) {
    const chain: any = {
      select: () => chain,
      from: () => chain,
      where: () => chain,
      orderBy: () => chain,
      limit: () => chain,
      offset: () => chain,
      then: (resolve: any) => resolve(returnValue),
    };
    return chain;
  }

  beforeEach(() => {
    mockDrizzle = { db: mockThenable([{ count: 0 }]) };
    service = new TicketsSearchService(mockDrizzle as DrizzleProvider);
  });

  it('doit retourner une structure paginée vide', async () => {
    const result = await service.search({ page: 1, limit: 10 });
    expect(result).toBeDefined();
    expect(result.meta.page).toBe(1);
    expect(result.meta.limit).toBe(10);
  });

  it('doit accepter un filtre de statut', async () => {
    const result = await service.search({ status: 'NEW', page: 1, limit: 10 });
    expect(result).toBeDefined();
    expect(result.meta).toBeDefined();
  });

  it('doit accepter plusieurs filtres combinés', async () => {
    const result = await service.search({
      status: 'IN_PROGRESS',
      priority: 'HIGH',
      category: 'NETWORK',
      page: 1,
      limit: 20,
    });
    expect(result).toBeDefined();
  });

  it('doit utiliser les valeurs par défaut si page/limit non fournies', async () => {
    const result = await service.search({});
    expect(result.meta.page).toBe(1);
    expect(result.meta.limit).toBe(20);
    expect(result.meta).toBeDefined();
  });
});
