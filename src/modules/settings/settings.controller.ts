import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { SettingsService } from './settings.service';
import { UpdateSettingDto } from './dto/update-setting.dto';

@ApiTags('Settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @ApiOperation({ summary: 'Lister tous les paramètres système globaux' })
  @ApiResponse({ status: 200, description: 'Liste des paramètres retournée avec succès.' })
  @Roles('ADMINISTRATOR', 'SUPERVISOR')
  @Get()
  async getAll() {
    const data = await this.settingsService.getAllSettings();
    return { success: true, data };
  }

  @ApiOperation({ summary: 'Mettre à jour un paramètre système par sa clé' })
  @ApiResponse({ status: 200, description: 'Paramètre mis à jour avec succès.' })
  @Roles('ADMINISTRATOR')
  @Patch(':key')
  async update(@Param('key') key: string, @Body() dto: UpdateSettingDto) {
    await this.settingsService.updateSetting(key, dto.value, dto.description);
    return { success: true, message: `Configuration '${key}' mise à jour.` };
  }
}
