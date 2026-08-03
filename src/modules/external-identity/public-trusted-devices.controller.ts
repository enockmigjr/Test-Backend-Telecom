import { Controller, Delete, Get, Param, ParseUUIDPipe, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Auth, AuthMode } from '../../common/decorators/auth-mode.decorator';
import { PublicSupportApi } from '../../common/openapi/public-support-api.decorator';
import { PublicSupportRequest, requirePublicPrincipal } from '../public-support/public-request';
import { DeviceRevokedResponseDto } from './dto/public-identity-response.dto';
import { TrustedDeviceListResponseDto } from './dto/trusted-device-response.dto';
import { TrustedDeviceService } from './services/trusted-device.service';

@ApiTags('Support public - appareils')
@ApiBearerAuth('publicSession')
@Auth(AuthMode.PUBLIC_SESSION)
@PublicSupportApi()
@Controller('public-support/session/devices')
export class PublicTrustedDevicesController {
  constructor(private readonly devices: TrustedDeviceService) {}

  @Get()
  @PublicSupportApi()
  @ApiOperation({ summary: 'Lister les appareils de confiance du demandeur' })
  @ApiOkResponse({ type: TrustedDeviceListResponseDto })
  list(@Req() request: PublicSupportRequest) {
    const principal = requirePublicPrincipal(request);
    return this.devices.list(principal.externalRequesterId, principal.supportIntegrationId, principal.deviceId);
  }

  @Delete(':id')
  @PublicSupportApi()
  @ApiOperation({ summary: 'Révoquer un appareil de confiance précis' })
  @ApiOkResponse({ type: DeviceRevokedResponseDto })
  async revoke(@Param('id', ParseUUIDPipe) id: string, @Req() request: PublicSupportRequest) {
    const principal = requirePublicPrincipal(request);
    await this.devices.revokeScoped(id, principal.externalRequesterId, principal.supportIntegrationId);
    return { data: { revoked: true as const } };
  }
}
