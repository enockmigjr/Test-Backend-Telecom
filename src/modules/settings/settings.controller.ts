/**
 * ============================================================================
 * FICHIER : src/modules/settings/settings.controller.ts
 * RÔLE : Contrôleur REST de gestion des configurations système dynamiques.
 * EXPLICATION :
 * Ce contrôleur permet la consultation et la mise à jour des paramètres globaux de l'application (`/api/v1/settings`) :
 * 1. `GET /` : Liste des configurations système (heures d'ouverture des SLAs, délais d'auto-clôture 48h, etc.), accessible aux administrateurs et superviseurs.
 * 2. `PATCH /:key` : Modification d'un paramètre système par sa clé (ex: `BUSINESS_HOURS_START`), réservé exclusivement au rôle `ADMINISTRATOR`.
 * ============================================================================
 */

import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { SettingsService } from './settings.service';
import { UpdateSettingDto } from './dto/update-setting.dto';

/**
 * Contrôleur d'API pour la gestion des paramètres globaux de la plateforme.
 */
@ApiTags('Settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  /**
   * Extrait la liste complète des paramètres de configuration système.
   */
  @ApiOperation({ summary: 'Lister tous les paramètres système globaux' })
  @ApiResponse({ status: 200, description: 'Liste des paramètres retournée avec succès.' })
  @Roles('ADMINISTRATOR', 'SUPERVISOR')
  @Get()
  async getAll() {
    const data = await this.settingsService.getAllSettings();
    return { success: true, data };
  }

  /**
   * Met à jour la valeur et la description d'une clé de configuration système.
   *
   * @param key Clé unique du paramètre (ex: `AUTO_CLOSE_HOURS`).
   * @param dto Nouvelle valeur JSON / texte et description.
   */
  @ApiOperation({ summary: 'Mettre à jour un paramètre système par sa clé' })
  @ApiResponse({ status: 200, description: 'Paramètre mis à jour avec succès.' })
  @Roles('ADMINISTRATOR')
  @Patch(':key')
  async update(@Param('key') key: string, @Body() dto: UpdateSettingDto) {
    await this.settingsService.updateSetting(key, dto.value, dto.description);
    return { success: true, message: `Configuration '${key}' mise à jour.` };
  }
}
