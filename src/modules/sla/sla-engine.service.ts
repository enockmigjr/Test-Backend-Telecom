import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { calculateSlaDueDate } from '../../common/helpers/sla.helper';
import { SettingsService } from '../settings/settings.service';
import { SlaAlertProcessorService } from './sla-alert-processor.service';
import { SlaAutoCloseService } from './sla-auto-close.service';

@Injectable()
export class SlaEngineService {
  private readonly logger = new Logger(SlaEngineService.name);

  constructor(
    private readonly alertProcessor: SlaAlertProcessorService,
    private readonly autoCloseService: SlaAutoCloseService,
    private readonly settingsService: SettingsService,
  ) {}

  @Cron('*/5 * * * *')
  async checkSla(): Promise<void> {
    this.logger.debug('Verification periodique des SLA et auto-cloture...');
    await this.alertProcessor.process();
    await this.autoCloseService.process();
  }

  async calculateDueDate(
    createdAt: Date,
    resolutionMinutes: number,
    calendarType: '24_7' | 'BUSINESS_HOURS' = '24_7',
  ): Promise<Date> {
    const businessHours = await this.settingsService.getBusinessHours();
    const businessDays = await this.settingsService.getBusinessDays();
    return calculateSlaDueDate(createdAt, resolutionMinutes, calendarType, businessHours, businessDays);
  }
}
