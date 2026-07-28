import { Test } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MetricsService } from '../../common/metrics/metrics.service';
import { DrizzleProvider } from '../../database/drizzle.provider';
import { SlaAutoCloseService } from './sla-auto-close.service';

function selectQuery(results: readonly unknown[][]) {
  const limit = jest.fn();
  results.forEach((result) => limit.mockResolvedValueOnce(result));
  const builder = {
    from: jest.fn(),
    where: jest.fn(),
    limit,
  };
  builder.from.mockReturnValue(builder);
  builder.where.mockReturnValue(builder);
  return builder;
}

describe('SlaAutoCloseService', () => {
  const emit = jest.fn();
  const ticketsActive = { dec: jest.fn() };
  const transaction = jest.fn();
  const select = jest.fn();
  let service: SlaAutoCloseService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        SlaAutoCloseService,
        { provide: DrizzleProvider, useValue: { db: { select, transaction } } },
        { provide: MetricsService, useValue: { ticketsActive } },
        { provide: EventEmitter2, useValue: { emit } },
      ],
    }).compile();
    service = moduleRef.get(SlaAutoCloseService);
  });

  it('ne produit aucun effet si une autre instance a deja reclame le ticket', async () => {
    select.mockReturnValue(selectQuery([[{ id: 'ticket-1', ticketNumber: 'INC-1' }], [{ id: 'admin-1' }]]));
    const insert = jest.fn();
    const update = jest.fn(() => ({
      set: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({ returning: jest.fn().mockResolvedValue([]) }),
      }),
    }));
    transaction.mockImplementation(
      async (callback: (value: { update: typeof update; insert: typeof insert }) => Promise<boolean>) =>
        callback({ update, insert }),
    );

    await service.process();

    expect(insert).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
    expect(ticketsActive.dec).not.toHaveBeenCalled();
  });

  it('ecrit l historique dans la transaction avant les effets externes', async () => {
    select.mockReturnValue(selectQuery([[{ id: 'ticket-1', ticketNumber: 'INC-1' }], [{ id: 'admin-1' }]]));
    const values = jest.fn().mockResolvedValue(undefined);
    const insert = jest.fn(() => ({ values }));
    const update = jest.fn(() => ({
      set: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({ returning: jest.fn().mockResolvedValue([{ id: 'ticket-1' }]) }),
      }),
    }));
    transaction.mockImplementation(
      async (callback: (value: { update: typeof update; insert: typeof insert }) => Promise<boolean>) =>
        callback({ update, insert }),
    );

    await service.process();

    expect(values).toHaveBeenCalledWith(expect.objectContaining({ ticketId: 'ticket-1', userId: 'admin-1' }));
    expect(emit).toHaveBeenCalledTimes(2);
    expect(ticketsActive.dec).toHaveBeenCalledTimes(1);
  });
});
