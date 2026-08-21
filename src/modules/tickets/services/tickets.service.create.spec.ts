import { Test } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DrizzleProvider } from '../../../database/drizzle.provider';
import { TicketPermissions } from '../domain/ticket-permissions';
import { TicketStateMachine } from '../domain/ticket-status-transitions';
import { MetricsService } from '../../../common/metrics/metrics.service';
import { SettingsService } from '../../settings/settings.service';
import { TicketAssignmentTargetService } from './ticket-assignment-target.service';
import { TicketHistoryService } from './ticket-history.service';
import { TicketNumberService } from './ticket-number.service';
import { TicketsService } from './tickets.service';
import { TicketLifecycleService } from './ticket-lifecycle.service';
import { TicketAssignmentService } from './ticket-assignment.service';

function query(result: readonly unknown[]) {
  const builder = {
    from: jest.fn(),
    where: jest.fn(),
    leftJoin: jest.fn(),
    limit: jest.fn().mockResolvedValue(result),
  };
  builder.from.mockReturnValue(builder);
  builder.where.mockReturnValue(builder);
  builder.leftJoin.mockReturnValue(builder);
  return builder;
}

describe('TicketsService.createFromCommand', () => {
  const select = jest.fn();
  const values = jest.fn().mockResolvedValue(undefined);
  const insert = jest.fn(() => ({ values }));
  const emit = jest.fn();
  const history = { recordByActor: jest.fn() };
  const ticketsCreatedTotal = { inc: jest.fn() };
  const ticketsActive = { inc: jest.fn(), dec: jest.fn() };
  const effects: Array<() => void | Promise<void>> = [];
  const drizzle = {
    db: { select, insert },
    afterCommit: jest.fn((effect: () => void | Promise<void>) => effects.push(effect)),
    runInTransaction: jest.fn(async (callback: () => Promise<unknown>) => {
      const result = await callback();
      for (const effect of effects.splice(0)) await effect();
      return result;
    }),
  };
  let service: TicketsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    effects.splice(0);
    history.recordByActor.mockResolvedValue(undefined);
    select
      .mockReturnValueOnce(query([{ id: 'sla-1', firstResponseMinutes: 60, resolutionMinutes: 240 }]))
      .mockReturnValueOnce(query([{ name: 'Réseau' }]))
      .mockReturnValueOnce(query([{ id: 'ticket-1', ticketNumber: 'INC-2026-000001', priority: 'LOW' }]));
    const moduleRef = await Test.createTestingModule({
      providers: [
        TicketsService,
        { provide: DrizzleProvider, useValue: drizzle },
        { provide: TicketStateMachine, useValue: {} },
        { provide: TicketPermissions, useValue: {} },
        { provide: TicketNumberService, useValue: { generate: jest.fn().mockResolvedValue('INC-2026-000001') } },
        { provide: TicketHistoryService, useValue: history },
        { provide: EventEmitter2, useValue: { emit } },
        {
          provide: MetricsService,
          useValue: { ticketsCreatedTotal, ticketsActive, legacyTicketActorFallbackTotal: { inc: jest.fn() } },
        },
        {
          provide: SettingsService,
          useValue: {
            getBusinessHours: jest.fn().mockResolvedValue({ start: 8, end: 18 }),
            getBusinessDays: jest.fn().mockResolvedValue([1, 2, 3, 4, 5]),
          },
        },
        { provide: TicketAssignmentTargetService, useValue: {} },
        { provide: TicketLifecycleService, useValue: {} },
        { provide: TicketAssignmentService, useValue: {} },
      ],
    }).compile();
    service = moduleRef.get(TicketsService);
  });

  it('écrit ticket, historique et événements outbox dans la même transaction', async () => {
    await service.createFromCommand({
      input: ticketInput(),
      actor: {
        type: 'EXTERNAL_REQUESTER',
        externalRequesterId: 'requester-1',
        supportIntegrationId: 'integration-1',
      },
      sourceChannel: 'WEB_PORTAL',
      outboxEvents: [
        {
          mutationId: '00000000-0000-4000-8000-000000000001',
          schemaVersion: 1,
          eventType: 'TICKET_CREATED',
          deduplicationKey: 'ticket-1:created',
          payload: { v: 1 },
        },
      ],
    });

    expect(drizzle.runInTransaction).toHaveBeenCalledTimes(1);
    expect(values).toHaveBeenCalledTimes(2);
    expect(history.recordByActor).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenCalledWith('ticket.created', expect.any(Object));
    expect(ticketsCreatedTotal.inc).toHaveBeenCalledTimes(1);
  });

  it("n'exécute aucun effet post-commit si l'historique échoue", async () => {
    history.recordByActor.mockRejectedValueOnce(new Error('history failed'));

    await expect(service.create(ticketInput(), 'user-1')).rejects.toThrow('history failed');

    expect(emit).not.toHaveBeenCalled();
    expect(ticketsCreatedTotal.inc).not.toHaveBeenCalled();
  });
});

function ticketInput() {
  return {
    title: 'Panne réseau',
    description: 'Fibre interrompue',
    priority: 'LOW' as const,
    severity: 'S4' as const,
    categoryId: 'category-1',
    departmentId: 'department-1',
    assignedTeamId: 'department-1',
  };
}
