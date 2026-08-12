/**
 * ============================================================================
 * FICHIER : src/modules/sla/sla-alert-processor.service.spec.ts
 * RÔLE : Suite de tests unitaires pour le composant sla-alert-processor.service.
 * EXPLICATION :
 * Ce fichier contient les tests automatisés validant le comportement et l'intégrité de sla-alert-processor.service.
 * 1. Vérifie le fonctionnement nominal et les cas d'erreur.
 * 2. Garantit qu'aucune régression n'est introduite lors des évolutions du code.
 * ============================================================================
 */

import { DrizzleProvider } from '../../database/drizzle.provider';
import { SlaAlertNotifierService } from './sla-alert-notifier.service';
import { SlaAlertProcessorService } from './sla-alert-processor.service';
import { SlaAlertTicket } from './sla-alert.types';
import { SettingsService } from '../settings/settings.service';

interface SelectQueryMock {
  from: jest.Mock;
  leftJoin: jest.Mock;
  where: jest.Mock;
  limit: jest.Mock;
}

interface UpdateQueryMock {
  set: jest.Mock;
  where: jest.Mock;
  returning: jest.Mock;
}

describe('SlaAlertProcessorService', () => {
  const selectQuery: SelectQueryMock = {
    from: jest.fn(),
    leftJoin: jest.fn(),
    where: jest.fn(),
    limit: jest.fn(),
  };
  const updateQuery: UpdateQueryMock = {
    set: jest.fn(),
    where: jest.fn(),
    returning: jest.fn(),
  };
  const db = { select: jest.fn(), update: jest.fn() };
  const notifier = { notifyBreach: jest.fn(), notifyWarning: jest.fn() };
  let service: SlaAlertProcessorService;

  const ticket = (id: string): SlaAlertTicket => ({
    id,
    ticketNumber: `INC-${id}`,
    title: 'Incident reseau',
    priority: 'HIGH',
    status: 'ASSIGNED',
    severity: 'S2',
    categoryName: 'NETWORK',
    departmentName: 'NOC',
    departmentId: 'dept-001',
    assignedTo: 'agent-1',
    dueAt: new Date('2026-07-20T10:00:00Z'),
    assigneeEmail: 'agent@telecom.local',
    assigneeFirstName: 'Agent',
    assigneeLastName: 'NOC',
  });

  beforeEach(() => {
    jest.clearAllMocks();
    selectQuery.from.mockReturnValue(selectQuery);
    selectQuery.leftJoin.mockReturnValue(selectQuery);
    selectQuery.where.mockReturnValue(selectQuery);
    db.select.mockReturnValue(selectQuery);
    updateQuery.set.mockReturnValue(updateQuery);
    updateQuery.where.mockReturnValue(updateQuery);
    updateQuery.returning.mockResolvedValue([{ id: 'claimed' }]);
    db.update.mockReturnValue(updateQuery);
    notifier.notifyBreach.mockResolvedValue(undefined);
    notifier.notifyWarning.mockResolvedValue(undefined);
    service = new SlaAlertProcessorService(
      { db } as unknown as DrizzleProvider,
      notifier as unknown as SlaAlertNotifierService,
      { getSetting: jest.fn().mockResolvedValue('30') } as unknown as SettingsService,
    );
  });

  /** Test : suit independamment warnings et breaches des deux objectifs */

  it('suit independamment warnings et breaches des deux objectifs', async () => {
    const firstResponseBreach = ticket('first-breach');
    const resolutionBreach = ticket('resolution-breach');
    const firstResponseWarning = ticket('first-warning');
    const resolutionWarning = ticket('resolution-warning');
    selectQuery.limit
      .mockResolvedValueOnce([firstResponseBreach])
      .mockResolvedValueOnce([resolutionBreach])
      .mockResolvedValueOnce([firstResponseWarning])
      .mockResolvedValueOnce([resolutionWarning]);

    await service.process();

    expect(updateQuery.set).toHaveBeenCalledWith(
      expect.objectContaining({ firstResponseBreachedAt: expect.any(Date), slaBreached: true }),
    );
    expect(updateQuery.set).toHaveBeenCalledWith(
      expect.objectContaining({ resolutionBreachedAt: expect.any(Date), slaBreached: true }),
    );
    expect(updateQuery.set).toHaveBeenCalledWith({ firstResponseWarningSentAt: expect.any(Date) });
    expect(updateQuery.set).toHaveBeenCalledWith({ resolutionWarningSentAt: expect.any(Date) });
    expect(notifier.notifyBreach).toHaveBeenNthCalledWith(1, firstResponseBreach, 'FIRST_RESPONSE', expect.any(Date));
    expect(notifier.notifyBreach).toHaveBeenNthCalledWith(2, resolutionBreach, 'RESOLUTION', expect.any(Date));
    expect(notifier.notifyWarning).toHaveBeenNthCalledWith(1, firstResponseWarning, 'FIRST_RESPONSE', expect.any(Date));
    expect(notifier.notifyWarning).toHaveBeenNthCalledWith(2, resolutionWarning, 'RESOLUTION', expect.any(Date));
  });

  /** Test : n emet rien lorsqu aucune alerte n est due */

  it('n emet rien lorsqu aucune alerte n est due', async () => {
    selectQuery.limit.mockResolvedValue([]);

    await service.process();

    expect(db.update).not.toHaveBeenCalled();
    expect(notifier.notifyBreach).not.toHaveBeenCalled();
    expect(notifier.notifyWarning).not.toHaveBeenCalled();
  });

  /** Test : ignore une alerte deja reclamee par une autre instance */

  it('ignore une alerte deja reclamee par une autre instance', async () => {
    selectQuery.limit.mockResolvedValueOnce([ticket('concurrent')]).mockResolvedValue([]);
    updateQuery.returning.mockResolvedValueOnce([]).mockResolvedValue([]);

    await service.process();

    expect(notifier.notifyBreach).not.toHaveBeenCalled();
  });

  /** Test : libere le claim pour permettre un retry si la notification echoue */

  it('libere le claim pour permettre un retry si la notification echoue', async () => {
    selectQuery.limit.mockResolvedValueOnce([ticket('retryable')]).mockResolvedValue([]);
    notifier.notifyBreach.mockRejectedValueOnce(new Error('BullMQ indisponible'));

    await service.process();

    expect(updateQuery.set).toHaveBeenCalledWith(
      expect.objectContaining({ firstResponseBreachedAt: expect.any(Date), slaBreached: true }),
    );
    expect(updateQuery.set).toHaveBeenCalledWith(
      expect.objectContaining({
        firstResponseBreachedAt: null,
        slaBreached: expect.anything(),
      }),
    );
  });
});
