import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiExtraModels, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ExternalRequesterQueryDto } from './dto/external-requester-query.dto';
import {
  ExternalRequesterDetailDto,
  ExternalRequesterIdentityDto,
  ExternalRequesterListItemDto,
} from './dto/external-requester-response.dto';
import { ExternalRequestersAdminService } from './services/external-requesters-admin.service';

@ApiTags('external-requesters')
@ApiBearerAuth()
@ApiExtraModels(ExternalRequesterDetailDto, ExternalRequesterIdentityDto, ExternalRequesterListItemDto)
@UseGuards(RolesGuard)
@Controller('external-requesters')
export class ExternalRequestersController {
  constructor(private readonly requesters: ExternalRequestersAdminService) {}

  @Get()
  @Roles('ADMINISTRATOR', 'SUPERVISOR')
  @ApiOperation({
    summary: 'Liste paginée des demandeurs publics',
    description:
      'Profils publics conservés côté serveur, sans compte interne. Jamais d’adresse email ou de secret en clair. Lecture ADMINISTRATOR/SUPERVISOR.',
  })
  @ApiResponse({ status: 200, description: 'Liste paginée des demandeurs.' })
  @ApiResponse({ status: 401, description: 'Token JWT manquant ou expiré.' })
  @ApiResponse({ status: 403, description: 'Rôle insuffisant — ADMINISTRATOR ou SUPERVISOR requis.' })
  list(@Query() query: ExternalRequesterQueryDto) {
    return this.requesters.list(query);
  }

  @Get(':id')
  @Roles('ADMINISTRATOR', 'SUPERVISOR')
  @ApiOperation({
    summary: 'Consulter un demandeur public',
    description:
      'Détail avec synthèse des impacts (tickets, conversations, appareils, identités vérifiées) sans contenu ni valeur en clair.',
  })
  @ApiResponse({ status: 200, description: 'Demandeur trouvé.' })
  @ApiResponse({ status: 404, description: 'Demandeur introuvable.' })
  @ApiResponse({ status: 401, description: 'Token JWT manquant ou expiré.' })
  @ApiResponse({ status: 403, description: 'Rôle insuffisant — ADMINISTRATOR ou SUPERVISOR requis.' })
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.requesters.detail(id);
  }
}
