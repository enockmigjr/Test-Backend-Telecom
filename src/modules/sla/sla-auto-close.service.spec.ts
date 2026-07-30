/**
 * ============================================================================
 * FICHIER : src/modules/sla/sla-auto-close.service.spec.ts
 * RÔLE : Suite de tests unitaires pour le composant sla-auto-close.service.
 * EXPLICATION :
 * Ce fichier contient les tests automatisés validant le comportement et l'intégrité de sla-auto-close.service.
 * 1. Vérifie le fonctionnement nominal et les cas d'erreur.
 * 2. Garantit qu'aucune régression n'est introduite lors des évolutions du code.
 * ============================================================================
 */

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
  const select = jest.fn();
  const update = jest.fn();
  const insert = jest.fn();
  const runInTransaction = jest.fn(async (callback: () => Promise<boolean>) => callback());
  const afterCommit = jest.fn(async (effect: () => void | Promise<void>) => effect());
  let service: SlaAutoCloseService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        SlaAutoCloseService,
        { provide: DrizzleProvider, useValue: { db: { select, update, insert }, runInTransaction, afterCommit } },
        { provide: MetricsService, useValue: { ticketsActive } },
        { provide: EventEmitter2, useValue: { emit } },
      ],
    }).compile();
    service = moduleRef.get(SlaAutoCloseService);
  });

  /** Test : ne produit aucun effet si une autre instance a deja reclame le ticket */

  it('ne produit aucun effet si une autre instance a deja reclame le ticket', async () => {
    select.mockReturnValue(selectQuery([[{ id: 'ticket-1', ticketNumber: 'INC-1' }]]));
    update.mockReturnValue({
      set: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({ returning: jest.fn().mockResolvedValue([]) }),
      }),
    });

    await service.process();

    expect(insert).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
    expect(ticketsActive.dec).not.toHaveBeenCalled();
  });

  /** Test : ecrit l historique dans la transaction avant les effets externes */

  it('ecrit l historique dans la transaction avant les effets externes', async () => {
    select.mockReturnValue(selectQuery([[{ id: 'ticket-1', ticketNumber: 'INC-1' }]]));
    const values = jest.fn().mockResolvedValue(undefined);
    insert.mockReturnValue({ values });
    update.mockReturnValue({
      set: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({ returning: jest.fn().mockResolvedValue([{ id: 'ticket-1' }]) }),
      }),
    });

    await service.process();

    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({ ticketId: 'ticket-1', userId: null, actorType: 'SYSTEM' }),
    );
    expect(emit).toHaveBeenCalledTimes(2);
    expect(ticketsActive.dec).toHaveBeenCalledTimes(1);
  });
});
