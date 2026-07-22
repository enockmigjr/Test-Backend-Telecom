import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DrizzleProvider } from '../../database/drizzle.provider';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { AuditLogsService } from './audit-logs.service';

const supervisor: JwtPayload = {
  sub: 'supervisor-001',
  email: 'supervisor@telecom.local',
  role: 'SUPERVISOR',
  departmentId: 'dept-001',
  mustChangePassword: false,
  jti: 'jti-001',
};

function query<T>(rows: T[]): Record<string, jest.Mock> {
  const builder: Record<string, jest.Mock> = {};
  for (const method of ['from', 'where', 'orderBy', 'limit', 'offset']) {
    builder[method] = jest.fn(() => builder);
  }
  builder['then'] = jest.fn((resolve: (value: T[]) => void) => resolve(rows));
  return builder;
}

describe('AuditLogsService - scope supervisor', () => {
  const select = jest.fn();
  let service: AuditLogsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [AuditLogsService, { provide: DrizzleProvider, useValue: { db: { select } } }],
    }).compile();
    service = moduleRef.get(AuditLogsService);
  });

  it('applique le scope supervisor au detail', async () => {
    const entry = { id: 'audit-001', entityType: 'ticket', entityId: 'ticket-001' };
    const detailQuery = query([entry]);
    select.mockReturnValueOnce(query([])).mockReturnValueOnce(query([])).mockReturnValueOnce(detailQuery);
    await expect(service.findOne('audit-001', supervisor)).resolves.toEqual(entry);
    expect(detailQuery['where']).toHaveBeenCalled();
  });

  it('ne divulgue pas un detail hors scope', async () => {
    select.mockReturnValueOnce(query([])).mockReturnValueOnce(query([])).mockReturnValueOnce(query([]));
    await expect(service.findOne('audit-other', supervisor)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('borne la pagination de la liste', async () => {
    select
      .mockReturnValueOnce(query([]))
      .mockReturnValueOnce(query([]))
      .mockReturnValueOnce(query([{ count: 0 }]))
      .mockReturnValueOnce(query([]));
    const result = await service.search({ page: -1, limit: 1000 }, supervisor);
    expect(result.meta.page).toBe(1);
    expect(result.meta.limit).toBe(100);
  });
});
