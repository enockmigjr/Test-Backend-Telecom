import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Auth, AuthMode } from '../../common/decorators/auth-mode.decorator';
import { PublicSupportApi } from '../../common/openapi/public-support-api.decorator';
import { PublicIntegrationConfigQueryDto } from './dto/public-integration-config.dto';
import { PublicIntegrationConfigResponseDto } from './dto/public-portal-response.dto';
import { PublicIntegrationConfigService } from './services/public-integration-config.service';

@ApiTags('Support public - configuration')
@Controller('public-support')
export class PublicPortalConfigController {
  constructor(private readonly config: PublicIntegrationConfigService) {}

  @Get('config')
  @Auth(AuthMode.ANONYMOUS)
  @PublicSupportApi()
  @ApiOperation({ summary: "Charger la configuration publique bornée d'une intégration", security: [] })
  @ApiOkResponse({ type: PublicIntegrationConfigResponseDto })
  get(@Query() query: PublicIntegrationConfigQueryDto) {
    return this.config.get(query.integrationKey, query.origin);
  }
}
