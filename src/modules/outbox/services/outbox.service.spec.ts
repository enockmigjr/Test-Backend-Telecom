import { Test } from '@nestjs/testing';
import { DrizzleProvider } from '../../../database/drizzle.provider';
import { OutboxEvent } from '../../../database/schemas';
import { OutboxService } from './outbox.service';

function updateQuery() {
  const builder = {
    set: jest.fn(),
    where: jest.fn().mockResolvedValue(undefined),
  };
  builder.set.mockReturnValue(builder);
  return builder;
}

describe('OutboxService', () => {
  const update = jest.fn();
  let service: OutboxService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        OutboxService,
        {
          provide: DrizzleProvider,
          useValue: { db: { update }, runInTransaction: jest.fn() },
        },
      ],
    }).compile();
    service = moduleRef.get(OutboxService);
  });

  it('republie avec un délai et une erreur non sensible tant que les essais restent disponibles', async () => {
    const builder = updateQuery();
    update.mockReturnValue(builder);
    await service.failed(event({ attemptCount: 1, maxAttempts: 5 }), 'worker-1', {
      name: 'ProviderError',
      code: 'ETIMEDOUT',
      message: 'adresse-client@example.com',
    });

    expect(builder.set).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'PENDING',
        attemptCount: 2,
        failedAt: null,
        lockedAt: null,
        lockedBy: null,
        lastError: 'ProviderError:ETIMEDOUT',
      }),
    );
    expect(builder.set.mock.calls[0]?.[0]).not.toEqual(
      expect.objectContaining({ lastError: expect.stringContaining('adresse-client@example.com') }),
    );
  });

  it('marque définitivement en échec au dernier essai', async () => {
    const builder = updateQuery();
    update.mockReturnValue(builder);
    await service.failed(event({ attemptCount: 4, maxAttempts: 5 }), 'worker-1', new Error('secret'));

    expect(builder.set).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'FAILED',
        attemptCount: 5,
        failedAt: expect.any(Date),
        lastError: 'Error',
      }),
    );
  });
});

function event(overrides: Partial<OutboxEvent>): OutboxEvent {
  const now = new Date('2026-08-03T00:00:00.000Z');
  return {
    id: '00000000-0000-7000-8000-000000000001',
    mutationId: '00000000-0000-7000-8000-000000000002',
    schemaVersion: 1,
    supportIntegrationId: '00000000-0000-7000-8000-000000000003',
    actorType: 'SYSTEM',
    userId: null,
    externalRequesterId: null,
    aggregateType: 'TICKET',
    aggregateId: '00000000-0000-7000-8000-000000000004',
    eventType: 'PUBLIC_TICKET_CREATED',
    deduplicationKey: 'ticket-created:1',
    payload: {},
    status: 'PROCESSING',
    attemptCount: 0,
    maxAttempts: 5,
    availableAt: now,
    lockedAt: now,
    lockedBy: 'worker-1',
    publishedAt: null,
    failedAt: null,
    lastError: null,
    createdAt: now,
    ...overrides,
  };
}
