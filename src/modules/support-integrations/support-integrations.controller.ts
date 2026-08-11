import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { RolesGuard } from '../auth/guards/roles.guard';
import {
  CreateSupportIntegrationDto,
  RotateIntegrationSecretDto,
  UpdateSupportIntegrationDto,
} from './dto/support-integration.dto';
import { IntegrationSecretService } from './services/integration-secret.service';
import { SupportIntegrationsService } from './services/support-integrations.service';
import { IntegrationDeviceAdminService } from './services/integration-device-admin.service';
import { IntegrationDeviceQueryDto } from './dto/integration-device-query.dto';

@ApiTags('support-integrations')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('support-integrations')
export class SupportIntegrationsController {
  constructor(
    private readonly integrations: SupportIntegrationsService,
    private readonly secrets: IntegrationSecretService,
    private readonly devices: IntegrationDeviceAdminService,
  ) {}

  @Post()
  @Roles('ADMINISTRATOR')
  @ApiOperation({ summary: 'Créer une intégration de support en brouillon' })
  create(@Body() dto: CreateSupportIntegrationDto, @CurrentUser() user: JwtPayload) {
    return this.integrations.create(dto, user.sub);
  }

  @Get()
  @Roles('ADMINISTRATOR', 'SUPERVISOR')
  @ApiOperation({ summary: 'Lister les intégrations sans exposer leurs secrets' })
  list() {
    return this.integrations.list();
  }

  @Get(':id')
  @Roles('ADMINISTRATOR', 'SUPERVISOR')
  @ApiOperation({ summary: 'Consulter une intégration' })
  findOne(@Param('id') id: string) {
    return this.integrations.findOne(id);
  }

  @Patch(':id')
  @Roles('ADMINISTRATOR')
  @ApiOperation({ summary: 'Modifier politiques, origines ou statut' })
  update(@Param('id') id: string, @Body() dto: UpdateSupportIntegrationDto, @CurrentUser() user: JwtPayload) {
    return this.integrations.update(id, dto, user.sub);
  }

  @Post(':id/credentials/rotate')
  @Roles('ADMINISTRATOR')
  @ApiOperation({ summary: 'Chiffrer une nouvelle version de secret sans la retourner' })
  rotateSecret(@Param('id') id: string, @Body() dto: RotateIntegrationSecretDto, @CurrentUser() user: JwtPayload) {
    return this.secrets.rotate(id, dto.secret, user.sub);
  }

  @Get(':id/credentials')
  @Roles('ADMINISTRATOR', 'SUPERVISOR')
  @ApiOperation({ summary: 'Lister les versions de secret sans exposer leur valeur chiffrée' })
  listCredentials(@Param('id') id: string) {
    return this.secrets.listMetadata(id);
  }

  @Post(':id/credentials/:credentialId/revoke')
  @Roles('ADMINISTRATOR')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Révoquer une version de secret' })
  async revokeSecret(
    @Param('id') id: string,
    @Param('credentialId') credentialId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    await this.secrets.revoke(id, credentialId, user.sub);
  }

  @Get(':id/devices')
  @Roles('ADMINISTRATOR', 'SUPERVISOR')
  @ApiOperation({ summary: 'Lister les appareils de confiance sans exposer leurs jetons' })
  listDevices(@Param('id') id: string, @Query() query: IntegrationDeviceQueryDto) {
    return this.devices.list(id, query.page, query.limit);
  }

  @Post(':id/devices/:deviceId/revoke')
  @Roles('ADMINISTRATOR')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Révoquer un appareil de confiance' })
  async revokeDevice(
    @Param('id') id: string,
    @Param('deviceId') deviceId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    await this.devices.revoke(id, deviceId, user.sub);
  }
}
