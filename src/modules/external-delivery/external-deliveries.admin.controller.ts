import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiExtraModels, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ExternalDeliveryQueryDto } from './dto/external-delivery-query.dto';
import { ExternalDeliveryListItemDto } from './dto/external-delivery-response.dto';
import { ExternalDeliveryService } from './services/external-delivery.service';

@ApiTags('external-deliveries')
@ApiBearerAuth()
@ApiExtraModels(ExternalDeliveryListItemDto)
@UseGuards(RolesGuard)
@Controller('external-deliveries')
export class ExternalDeliveriesAdminController {
  constructor(private readonly deliveries: ExternalDeliveryService) {}

  @Get()
  @Roles('ADMINISTRATOR', 'SUPERVISOR')
  @ApiOperation({
    summary: 'Liste paginée des livraisons externes',
    description:
      'Livraisons sortantes (email, futur WhatsApp) sans contenu ni secret. Lecture ADMINISTRATOR/SUPERVISOR.',
  })
  @ApiResponse({ status: 200, description: 'Liste paginée des livraisons.' })
  @ApiResponse({ status: 401, description: 'Token JWT manquant ou expiré.' })
  @ApiResponse({ status: 403, description: 'Rôle insuffisant — ADMINISTRATOR ou SUPERVISOR requis.' })
  list(@Query() query: ExternalDeliveryQueryDto) {
    return this.deliveries.adminList(query);
  }

  @Get(':id')
  @Roles('ADMINISTRATOR', 'SUPERVISOR')
  @ApiOperation({
    summary: 'Consulter une livraison externe',
    description: 'Détail d’une livraison sans contenu ni secret. Lecture ADMINISTRATOR/SUPERVISOR.',
  })
  @ApiResponse({ status: 200, description: 'Livraison trouvée.' })
  @ApiResponse({ status: 404, description: 'Livraison introuvable.' })
  @ApiResponse({ status: 401, description: 'Token JWT manquant ou expiré.' })
  @ApiResponse({ status: 403, description: 'Rôle insuffisant — ADMINISTRATOR ou SUPERVISOR requis.' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.deliveries.adminFindOne(id);
  }
}
