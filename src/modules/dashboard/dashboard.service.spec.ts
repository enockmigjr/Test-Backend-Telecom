import { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';

import { DrizzleProvider } from '../../database/drizzle.provider';
import { DashboardSlaService } from './dashboard-sla.service';
import { DashboardService } from './dashboard.service';

type QueryRow = Readonly<Record<string, unknown>>;

interface QueryCapture {
  readonly selections: unknown[];
  readonly whereConditions: unknown[];
  readonly groupByExpressions: unknown[];
}

class MockQuery implements PromiseLike<readonly QueryRow[]> {
  constructor(
    private readonly result: readonly QueryRow[],
    private readonly capture: QueryCapture,
  ) {}

  from(): this {
    return this;
  }

  leftJoin(): this {
    return this;
  }

  where(condition: unknown): this {
    this.capture.whereConditions.push(condition);
    return this;
  }

  groupBy(...expressions: readonly unknown[]): this {
    this.capture.groupByExpressions.push(...expressions);
    return this;
  }

  orderBy(): this {
    return this;
  }

  then<TResult1 = readonly QueryRow[], TResult2 = never>(
    onfulfilled?: ((value: readonly QueryRow[]) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve(this.result).then(onfulfilled, onrejected);
  }
}

function createService(results: readonly (readonly QueryRow[])[] = []) {
  const capture: QueryCapture = { selections: [], whereConditions: [], groupByExpressions: [] };
  let queryIndex = 0;
  const db = {
    select(selection: unknown): MockQuery {
      capture.selections.push(selection);
      return new MockQuery(results[queryIndex++] ?? [], capture);
    },
  };
  const drizzle = Object.create(DrizzleProvider.prototype) as DrizzleProvider;
  Object.defineProperty(drizzle, 'db', { value: db });
  const dashboardSla = Object.create(DashboardSlaService.prototype) as DashboardSlaService;
  Object.defineProperty(dashboardSla, 'compliance', { value: jest.fn() });
  return { service: new DashboardService(drizzle, dashboardSla), capture };
}

function sqlQuery(value: unknown): { sql: string; params: unknown[] } {
  if (!(value instanceof SQL)) throw new Error('Expression SQL attendue');
  return new PgDialect().sqlToQuery(value);
}

describe('DashboardService', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('workload retourne la structure attendue', async () => {
    const { service } = createService();
    const result = await service.workload();

    expect(result.summary).toBeDefined();
    expect(result.generatedAt).toBeDefined();
  });

  it('ticketsByStatus retourne une période et ses données', async () => {
    const { service } = createService();
    const result = await service.ticketsByStatus();

    expect(result.period).toBeDefined();
    expect(result.data).toEqual([]);
  });

  it('ticketsByPriority retourne une période et ses données', async () => {
    const { service } = createService();
    const result = await service.ticketsByPriority();

    expect(result.period).toBeDefined();
    expect(result.data).toEqual([]);
  });

  it("limite le rapport des départements à l'équipe assignée du superviseur", async () => {
    const { service, capture } = createService();

    await service.departmentsReport(undefined, undefined, {
      sub: 'user-1',
      email: 'supervisor@example.test',
      role: 'SUPERVISOR',
      departmentId: 'department-1',
      jti: 'session-1',
    });

    const scopeQuery = sqlQuery(capture.whereConditions[0]);
    expect(scopeQuery.sql).toContain('assigned_team_id');
    expect(scopeQuery.params).toContain('department-1');
  });

  it('calcule createdToday et resolvedToday sur les vraies bornes du jour', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-22T14:30:00.000Z'));
    const results: readonly (readonly QueryRow[])[] = [
      [{ total: 9 }],
      [{ count: 4 }],
      [{ count: 1 }],
      [{ count: 2 }],
      [{ count: 3 }],
      [{ count: 1 }],
      [{ count: 1 }],
      [],
      [],
      [],
    ];
    const { service, capture } = createService(results);

    const result = await service.overview('2026-07-01T00:00:00.000Z', '2026-07-31T23:59:59.000Z');

    expect(result.ticketVolume.resolvedToday).toBe(2);
    expect(result.ticketVolume.createdToday).toBe(3);
    const expectedDayBounds = [new Date(2026, 6, 22), new Date(2026, 6, 23)].map((date) => date.toISOString());
    for (const condition of capture.whereConditions.slice(3, 5)) {
      expect(sqlQuery(condition).params.map(String)).toEqual(expectedDayBounds);
    }
  });

  it('retourne les percentiles SQL et une tendance hebdomadaire réelle', async () => {
    const results: readonly (readonly QueryRow[])[] = [
      [{ avgMinutes: '80.4', medianMinutes: '55.2', p90Minutes: '174.7', resolvedCount: 7 }],
      [
        { period: new Date('2026-07-06T00:00:00.000Z'), avgResolutionTimeMinutes: '60.5' },
        { period: '2026-07-13 00:00:00+00', avgResolutionTimeMinutes: '95.25' },
      ],
    ];
    const { service, capture } = createService(results);

    const result = await service.resolutionTime(undefined, undefined, 'week');

    expect(result.overall).toEqual({
      avgResolutionTimeMinutes: 80,
      medianResolutionTimeMinutes: 55,
      p90ResolutionTimeMinutes: 175,
    });
    expect(result.trend).toEqual([
      { period: '2026-07-06T00:00:00.000Z', avgResolutionTimeMinutes: 60.5 },
      { period: '2026-07-13T00:00:00.000Z', avgResolutionTimeMinutes: 95.25 },
    ]);
    expect(sqlQuery(capture.groupByExpressions[0]).sql.toLowerCase()).toContain("date_trunc('week'");
    const selectionSql = capture.selections
      .flatMap((selection) => (typeof selection === 'object' && selection !== null ? Object.values(selection) : []))
      .filter((value): value is SQL => value instanceof SQL)
      .map((value) => sqlQuery(value).sql)
      .join(' ')
      .toLowerCase();
    expect(selectionSql).toContain('percentile_cont(0.5)');
    expect(selectionSql).toContain('percentile_cont(0.9)');
  });
});
