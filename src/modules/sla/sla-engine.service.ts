/**
 * ============================================================================
 * FICHIER : src/modules/sla/sla-engine.service.ts
 * RÔLE : Moteur principal d'évaluation des contrats de service (SLA) et de calcul des échéances.
 * EXPLICATION :
 * Ce service orchestre la surveillance temporelle et le calcul des délais de réponse/résolution :
 * 1. `@Cron('* /5 * * * *')` : Exécute toutes les 5 minutes l'évaluation des dépassements/avertissements SLA (`SlaAlertProcessorService`) et l'auto-clôture 48h (`SlaAutoCloseService`).
 * 2. `calculateDueDate` : Détermine l'échéance exacte d'un ticket en minutes selon le calendrier configuré (`24_7` continu ou `BUSINESS_HOURS` ouvré avec prise en compte des heures/jours ouvrés du `SettingsService`).
 * ============================================================================
 */

import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { calculateSlaDueDate } from '../../common/helpers/sla.helper';
import { SettingsService } from '../settings/settings.service';
import { SlaAlertProcessorService } from './sla-alert-processor.service';
import { SlaAutoCloseService } from './sla-auto-close.service';

/**
 * Service orchestrateur du moteur de contrats de niveau de service (SLA).
 */
@Injectable()
export class SlaEngineService {
  private readonly logger = new Logger(SlaEngineService.name);

  constructor(
    private readonly alertProcessor: SlaAlertProcessorService,
    private readonly autoCloseService: SlaAutoCloseService,
    private readonly settingsService: SettingsService,
  ) {}

  /**
   * Tâche Cron périodique exécutée toutes les 5 minutes pour contrôler la conformité SLA et clôturer les tickets obsolètes.
   */
  @Cron('*/5 * * * *')
  async checkSla(): Promise<void> {
    this.logger.debug('Vérification périodique des SLA et auto-clôture...');
    await this.alertProcessor.process();
    await this.autoCloseService.process();
  }

  /**
   * Calcule la date limite exacte de résolution d'un ticket d'incident.
   *
   * @param createdAt Date de création de l'incident.
   * @param resolutionMinutes Nombre de minutes accordées par la politique SLA.
   * @param calendarType Mode de calendrier ('24_7' ou 'BUSINESS_HOURS').
   * @returns La date exacte d'échéance du contrat SLA.
   */
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
