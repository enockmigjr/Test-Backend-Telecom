import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiExtraModels, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequireIdempotency } from '../../common/decorators/idempotent.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { RolesGuard } from '../auth/guards/roles.guard';
import { MergeRequesterDto } from './dto/merge-requester.dto';
import { ExternalRequesterQueryDto } from './dto/external-requester-query.dto';
import {
  ExternalRequesterDetailDto,
  ExternalRequesterIdentityDto,
  ExternalRequesterListItemDto,
  MergeRequesterPreviewDto,
  MergeRequesterResultDto,
  RequesterAnonymizedDto,
} from './dto/external-requester-response.dto';
import { ExternalRequestersAdminService } from './services/external-requesters-admin.service';

@ApiTags('external-requesters')
@ApiBearerAuth()
@ApiExtraModels(
  ExternalRequesterDetailDto,
  ExternalRequesterIdentityDto,
  ExternalRequesterListItemDto,
  MergeRequesterPreviewDto,
  MergeRequesterResultDto,
  RequesterAnonymizedDto,
)
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

  @Post(':id/merge/preview')
  @Roles('ADMINISTRATOR', 'SUPERVISOR')
  @ApiOperation({
    summary: 'Aperçu d’une fusion de profils demandeur',
    description:
      'Impacts détaillés sans mutation : tickets, conversations, messages, appareils, identités et doublons potentiels. Lecture ADMINISTRATOR/SUPERVISOR.',
  })
  @ApiResponse({ status: 200, description: 'Impacts de la fusion.' })
  @ApiResponse({ status: 404, description: 'Demandeur introuvable.' })
  @ApiResponse({ status: 401, description: 'Token JWT manquant ou expiré.' })
  @ApiResponse({ status: 403, description: 'Rôle insuffisant.' })
  mergePreview(@Param('id', ParseUUIDPipe) id: string) {
    return this.requesters.mergePreview(id);
  }

  @Post(':id/merge')
  @Roles('ADMINISTRATOR')
  @RequireIdempotency()
  @ApiOperation({
    summary: 'Fusionner un demandeur public vers un profil cible',
    description:
      'Rattache toutes les références du profil source au profil cible (même intégration), supprime les identités en doublon et écrit une trace d’audit. Écriture ADMINISTRATOR uniquement.',
  })
  @ApiResponse({ status: 200, description: 'Fusion exécutée.' })
  @ApiResponse({ status: 400, description: 'Fusion refusée (profil anonymisé ou même profil).' })
  @ApiResponse({ status: 404, description: 'Profil source ou cible introuvable.' })
  @ApiResponse({ status: 401, description: 'Token JWT manquant ou expiré.' })
  @ApiResponse({ status: 403, description: 'Rôle insuffisant — ADMINISTRATOR requis.' })
  merge(@Param('id', ParseUUIDPipe) id: string, @Body() dto: MergeRequesterDto, @CurrentUser() user: JwtPayload) {
    return this.requesters.merge(id, dto, user.sub);
  }

  @Post(':id/anonymize')
  @Roles('ADMINISTRATOR')
  @RequireIdempotency()
  @ApiOperation({
    summary: 'Anonymiser un demandeur public',
    description:
      'Efface le nom, la locale, les métadonnées et les valeurs d’identité chiffrées, révoque les appareils et challenges, puis écrit une trace d’audit. Les tickets restent rattachés au profil anonymisé.',
  })
  @ApiResponse({ status: 200, description: 'Demandeur anonymisé.' })
  @ApiResponse({ status: 404, description: 'Demandeur introuvable.' })
  @ApiResponse({ status: 401, description: 'Token JWT manquant ou expiré.' })
  @ApiResponse({ status: 403, description: 'Rôle insuffisant — ADMINISTRATOR requis.' })
  anonymize(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.requesters.anonymize(id, user.sub);
  }
}
