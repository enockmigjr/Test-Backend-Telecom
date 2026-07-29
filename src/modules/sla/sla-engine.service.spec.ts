/**
 * ============================================================================
 * FICHIER : src/modules/sla/sla-engine.service.spec.ts
 * RÔLE : Suite de tests unitaires pour le composant sla-engine.service.
 * EXPLICATION :
 * Ce fichier contient les tests automatisés validant le comportement et l'intégrité de sla-engine.service.
 * 1. Vérifie le fonctionnement nominal et les cas d'erreur.
 * 2. Garantit qu'aucune régression n'est introduite lors des évolutions du code.
 * ============================================================================
 */

import { SettingsService } from '../settings/settings.service';
import { SlaAlertProcessorService } from './sla-alert-processor.service';
import { SlaAutoCloseService } from './sla-auto-close.service';
import { SlaEngineService } from './sla-engine.service';

describe('SlaEngineService', () => {
  const alertProcessor = { process: jest.fn<Promise<void>, []>() };
  const autoCloseService = { process: jest.fn<Promise<void>, []>() };
  const settingsService = {
    getBusinessHours: jest.fn<Promise<{ start: number; end: number }>, []>(),
    getBusinessDays: jest.fn<Promise<number[]>, []>(),
  };
  let service: SlaEngineService;

  beforeEach(() => {
    jest.clearAllMocks();
    alertProcessor.process.mockResolvedValue();
    autoCloseService.process.mockResolvedValue();
    settingsService.getBusinessHours.mockResolvedValue({ start: 8, end: 18 });
    settingsService.getBusinessDays.mockResolvedValue([1, 2, 3, 4, 5]);
    service = new SlaEngineService(
      alertProcessor as unknown as SlaAlertProcessorService,
      autoCloseService as unknown as SlaAutoCloseService,
      settingsService as unknown as SettingsService,
    );
  });

  /** Test : traite les deux objectifs SLA avant la cloture automatique */

  it('traite les deux objectifs SLA avant la cloture automatique', async () => {
    await service.checkSla();

    expect(alertProcessor.process).toHaveBeenCalledTimes(1);
    expect(autoCloseService.process).toHaveBeenCalledTimes(1);
    expect(alertProcessor.process.mock.invocationCallOrder[0]).toBeLessThan(
      autoCloseService.process.mock.invocationCallOrder[0],
    );
  });

  /** Test : calcule une echeance 24/7 sans muter la date source */

  it('calcule une echeance 24/7 sans muter la date source', async () => {
    const createdAt = new Date('2026-06-26T10:00:00Z');

    const dueDate = await service.calculateDueDate(createdAt, 120);

    expect(dueDate.toISOString()).toBe('2026-06-26T12:00:00.000Z');
    expect(dueDate).not.toBe(createdAt);
  });
});
