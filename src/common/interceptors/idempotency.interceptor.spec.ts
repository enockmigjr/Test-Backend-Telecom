import { CallHandler, ConflictException, ExecutionContext } from '@nestjs/common';
import { createHash } from 'crypto';
import { Reflector } from '@nestjs/core';
import { lastValueFrom, of, throwError } from 'rxjs';
import { DrizzleProvider } from '../../database/drizzle.provider';
import { IdempotencyInterceptor } from './idempotency.interceptor';

describe('IdempotencyInterceptor', () => {
  const limit = jest.fn();
  const values = jest.fn();
  const updateWhere = jest.fn();
  const deleteWhere = jest.fn();
  const db = {
    select: jest.fn(() => ({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({ limit }),
      }),
    })),
    insert: jest.fn(() => ({ values })),
    update: jest.fn(() => ({
      set: jest.fn().mockReturnValue({ where: updateWhere }),
    })),
    delete: jest.fn(() => ({ where: deleteWhere })),
  };
  const runInTransaction = jest.fn(async (callback: () => Promise<unknown>) => callback());
  let interceptor: IdempotencyInterceptor;

  beforeEach(() => {
    jest.clearAllMocks();
    limit.mockResolvedValue([]);
    values.mockResolvedValue(undefined);
    updateWhere.mockResolvedValue(undefined);
    deleteWhere.mockResolvedValue(undefined);
    const reflector = new Reflector();
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);
    interceptor = new IdempotencyInterceptor(reflector, { db, runInTransaction } as unknown as DrizzleProvider);
  });

  it('persiste la clé, la mutation et la réponse dans une même transaction', async () => {
    const result = await lastValueFrom(await interceptor.intercept(context(), handler({ id: 'ticket-1' })));

    expect(result).toEqual({ id: 'ticket-1' });
    expect(runInTransaction).toHaveBeenCalledTimes(1);
    expect(deleteWhere).toHaveBeenCalledTimes(1);
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({ userId: '00000000-0000-0000-0000-000000000001', fingerprint: expect.any(String) }),
    );
    expect(updateWhere).toHaveBeenCalledTimes(1);
  });

  it('rejoue une réponse terminée sans rappeler le contrôleur', async () => {
    limit.mockResolvedValue([{ fingerprint: hashBody(), statusCode: 201, responseBody: { id: 'ticket-1' } }]);
    const next = handler({ id: 'ticket-2' });

    const result = await lastValueFrom(await interceptor.intercept(context(), next));

    expect(result).toEqual({ id: 'ticket-1' });
    expect(next.handle).not.toHaveBeenCalled();
  });

  it('refuse la réutilisation de la clé avec un autre contenu', async () => {
    limit.mockResolvedValue([{ fingerprint: 'different', statusCode: 201, responseBody: {} }]);

    await expect(interceptor.intercept(context(), handler({ id: 'ticket-1' }))).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('propage une erreur métier afin que la transaction annule aussi la clé', async () => {
    const failure = new Error('échec métier');
    const next: CallHandler = { handle: jest.fn(() => throwError(() => failure)) };

    await expect(interceptor.intercept(context(), next)).rejects.toBe(failure);
    expect(updateWhere).not.toHaveBeenCalled();
  });

  it('rejoue le résultat du gagnant après un conflit unique concurrent', async () => {
    limit
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ fingerprint: hashBody(), statusCode: 201, responseBody: { id: 'winner' } }]);
    values.mockRejectedValueOnce(
      Object.assign(new Error('duplicate'), { code: '23505', constraint_name: 'idempotency_records_pkey' }),
    );

    const result = await lastValueFrom(await interceptor.intercept(context(), handler({ id: 'loser' })));

    expect(result).toEqual({ id: 'winner' });
  });

  it('ne masque pas une violation unique provenant de la mutation métier', async () => {
    const businessViolation = Object.assign(new Error('ticket number duplicate'), {
      code: '23505',
      constraint_name: 'tickets_ticket_number_unique',
    });
    const next: CallHandler = { handle: jest.fn(() => throwError(() => businessViolation)) };

    await expect(interceptor.intercept(context(), next)).rejects.toBe(businessViolation);
  });

  function handler(value: unknown): CallHandler {
    return { handle: jest.fn(() => of(value)) };
  }

  function context(): ExecutionContext {
    const response = { statusCode: 201, status: jest.fn().mockReturnThis() };
    const request = {
      headers: { 'idempotency-key': 'ticket-create-1' },
      user: { sub: '00000000-0000-0000-0000-000000000001' },
      method: 'POST',
      baseUrl: '/api/v1/tickets',
      path: '/',
      body: { title: 'Panne' },
    };
    return {
      getHandler: () => handler,
      getClass: () => IdempotencyInterceptor,
      switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }),
    } as unknown as ExecutionContext;
  }

  function hashBody(): string {
    return createHash('sha256')
      .update(JSON.stringify({ title: 'Panne' }))
      .digest('hex');
  }
});
