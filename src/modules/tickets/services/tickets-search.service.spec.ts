import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { DrizzleProvider } from '../../../database/drizzle.provider';
import { Test } from '@nestjs/testing';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { SearchTicketsDto } from '../dto/search-tickets.dto';
import { TicketsSearchService } from './tickets-search.service';

const agent: JwtPayload = {
  sub: 'agent-001',
  email: 'agent@telecom.local',
  role: 'NOC_ENGINEER',
  departmentId: 'dept-001',
  mustChangePassword: false,
  jti: 'jti-001',
};

function database(rows: readonly object[] = []) {
  const chain: Record<string, jest.Mock> = {};
  for (const method of ['select', 'from', 'leftJoin', 'where', 'orderBy', 'limit', 'offset']) {
    chain[method] = jest.fn(() => chain);
  }
  chain['then'] = jest.fn((resolve: (value: readonly object[]) => void) => resolve(rows));
  return chain;
}

describe('TicketsSearchService', () => {
  it('applique le scope utilisateur et borne la pagination', async () => {
    const db = database([{ count: 0 }]);
    const moduleRef = await Test.createTestingModule({
      providers: [TicketsSearchService, { provide: DrizzleProvider, useValue: { db } }],
    }).compile();
    const service = moduleRef.get(TicketsSearchService);
    const result = await service.search({ page: 0, limit: 500, search: 'CLIENT-001' }, agent);
    expect(db['where']).toHaveBeenCalled();
    expect(db['limit']).toHaveBeenCalledWith(100);
    expect(result.meta.page).toBe(1);
    expect(result.meta.limit).toBe(100);
  });

  it('applique le champ et ordre de tri demandes', async () => {
    const db = database([{ count: 0 }]);
    const moduleRef = await Test.createTestingModule({
      providers: [TicketsSearchService, { provide: DrizzleProvider, useValue: { db } }],
    }).compile();
    const service = moduleRef.get(TicketsSearchService);
    await service.search({ sort: 'priority', order: 'asc' }, agent);
    expect(db['orderBy']).toHaveBeenCalledTimes(1);
  });

  it('rejette un champ de tri non supporte au niveau DTO', async () => {
    const dto = plainToInstance(SearchTicketsDto, { sort: 'drop_table', order: 'sideways' });
    const errors = await validate(dto);
    expect(errors.map((error) => error.property)).toEqual(expect.arrayContaining(['sort', 'order']));
  });
});
