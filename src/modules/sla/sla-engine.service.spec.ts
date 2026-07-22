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

  it('traite les deux objectifs SLA avant la cloture automatique', async () => {
    await service.checkSla();

    expect(alertProcessor.process).toHaveBeenCalledTimes(1);
    expect(autoCloseService.process).toHaveBeenCalledTimes(1);
    expect(alertProcessor.process.mock.invocationCallOrder[0]).toBeLessThan(
      autoCloseService.process.mock.invocationCallOrder[0],
    );
  });

  it('calcule une echeance 24/7 sans muter la date source', async () => {
    const createdAt = new Date('2026-06-26T10:00:00Z');

    const dueDate = await service.calculateDueDate(createdAt, 120);

    expect(dueDate.toISOString()).toBe('2026-06-26T12:00:00.000Z');
    expect(dueDate).not.toBe(createdAt);
  });
});
