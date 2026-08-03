import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Auth, AuthMode } from '../../common/decorators/auth-mode.decorator';
import { Idempotent, RequireIdempotency } from '../../common/decorators/idempotent.decorator';
import { PublicSupportApi } from '../../common/openapi/public-support-api.decorator';
import {
  CreatePublicConversationDto,
  ConfirmPublicTicketDto,
  PublicHandoffDto,
  SavePublicTicketDraftDto,
} from './dto/public-conversation.dto';
import { CreatePublicCommentDto, UpdatePublicPreferencesDto } from './dto/public-ticket.dto';
import {
  PublicCatalogResponseDto,
  PublicConversationStateResponseDto,
  PublicDraftSavedResponseDto,
  PublicHandoffResponseDto,
  PublicPreferencesResponseDto,
  PublicTicketConfirmedResponseDto,
} from './dto/public-support-response.dto';
import {
  PublicCommentResponseDto,
  PublicTicketDetailResponseDto,
  PublicTicketListResponseDto,
  PublicTimelineResponseDto,
} from './dto/public-ticket-response.dto';
import { PublicSupportRequest, requirePublicPrincipal } from './public-request';
import { PublicAdmissionPolicyService } from './services/public-admission-policy.service';
import { PublicConversationService } from './services/public-conversation.service';
import { PublicPreferencesService } from './services/public-preferences.service';
import { PublicTicketService } from './services/public-ticket.service';

@ApiTags('Support public - demandes')
@ApiBearerAuth('publicSession')
@Auth(AuthMode.PUBLIC_SESSION)
@PublicSupportApi()
@Controller('public-support')
export class PublicSupportController {
  constructor(
    private readonly admission: PublicAdmissionPolicyService,
    private readonly conversations: PublicConversationService,
    private readonly tickets: PublicTicketService,
    private readonly preferences: PublicPreferencesService,
  ) {}

  @Get('catalog')
  @PublicSupportApi()
  @ApiOperation({ summary: 'Catalogue public autorisé pour cette intégration' })
  @ApiOkResponse({ type: PublicCatalogResponseDto })
  catalog(@Req() request: PublicSupportRequest) {
    return this.admission.catalog(requirePublicPrincipal(request).supportIntegrationId);
  }

  @Post('conversations')
  @HttpCode(HttpStatus.CREATED)
  @RequireIdempotency()
  @PublicSupportApi()
  @ApiOperation({ summary: 'Démarrer une conversation de support' })
  @ApiCreatedResponse({ type: PublicConversationStateResponseDto })
  createConversation(@Req() request: PublicSupportRequest, @Body() dto: CreatePublicConversationDto) {
    return this.conversations.create(requirePublicPrincipal(request), dto.serviceKey);
  }

  @Patch('conversations/:id/draft')
  @Idempotent()
  @PublicSupportApi()
  @ApiHeader({ name: 'Idempotency-Key', required: false })
  @ApiOperation({ summary: 'Enregistrer le brouillon qualifié' })
  @ApiOkResponse({ type: PublicDraftSavedResponseDto })
  saveDraft(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: PublicSupportRequest,
    @Body() dto: SavePublicTicketDraftDto,
  ) {
    return this.conversations.saveDraft(id, requirePublicPrincipal(request), dto);
  }

  @Post('conversations/:id/confirm')
  @RequireIdempotency()
  @PublicSupportApi()
  @ApiOperation({ summary: 'Confirmer et créer atomiquement le ticket' })
  @ApiCreatedResponse({ type: PublicTicketConfirmedResponseDto })
  confirm(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: PublicSupportRequest,
    @Body() dto: ConfirmPublicTicketDto,
  ) {
    return this.conversations.confirm(id, requirePublicPrincipal(request), dto.confirmed);
  }

  @Post('conversations/:id/handoff')
  @RequireIdempotency()
  @PublicSupportApi()
  @ApiOperation({ summary: 'Demander explicitement un transfert humain' })
  @ApiCreatedResponse({ type: PublicHandoffResponseDto })
  handoff(@Param('id', ParseUUIDPipe) id: string, @Req() request: PublicSupportRequest, @Body() dto: PublicHandoffDto) {
    return this.conversations.requestHandoff(id, requirePublicPrincipal(request), dto.reason);
  }

  @Get('tickets')
  @PublicSupportApi()
  @ApiOperation({ summary: 'Lister uniquement les demandes du contact courant' })
  @ApiQuery({ name: 'page', required: false, schema: { type: 'integer', minimum: 1, default: 1 } })
  @ApiQuery({ name: 'limit', required: false, schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } })
  @ApiOkResponse({ type: PublicTicketListResponseDto })
  listTickets(@Req() request: PublicSupportRequest, @Query('page') page?: string, @Query('limit') limit?: string) {
    return this.tickets.list(requirePublicPrincipal(request), page, limit);
  }

  @Get('tickets/:id')
  @PublicSupportApi()
  @ApiOperation({ summary: 'Consulter une demande publique' })
  @ApiOkResponse({ type: PublicTicketDetailResponseDto })
  ticket(@Param('id', ParseUUIDPipe) id: string, @Req() request: PublicSupportRequest) {
    return this.tickets.detail(id, requirePublicPrincipal(request));
  }

  @Get('tickets/:id/timeline')
  @PublicSupportApi()
  @ApiOperation({ summary: 'Consulter la timeline publique filtrée' })
  @ApiOkResponse({ type: PublicTimelineResponseDto })
  timeline(@Param('id', ParseUUIDPipe) id: string, @Req() request: PublicSupportRequest) {
    return this.tickets.timeline(id, requirePublicPrincipal(request));
  }

  @Post('tickets/:id/comments')
  @RequireIdempotency()
  @PublicSupportApi()
  @ApiOperation({ summary: 'Ajouter un commentaire demandeur' })
  @ApiCreatedResponse({ type: PublicCommentResponseDto })
  addComment(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: PublicSupportRequest,
    @Body() dto: CreatePublicCommentDto,
  ) {
    return this.tickets.addComment(id, requirePublicPrincipal(request), dto.content);
  }

  @Get('preferences')
  @PublicSupportApi()
  @ApiOperation({ summary: 'Consulter le profil public conservé' })
  @ApiOkResponse({ type: PublicPreferencesResponseDto })
  getPreferences(@Req() request: PublicSupportRequest) {
    return this.preferences.get(requirePublicPrincipal(request));
  }

  @Patch('preferences')
  @RequireIdempotency()
  @PublicSupportApi()
  @ApiOperation({ summary: 'Mettre à jour le nom et la langue du profil public' })
  @ApiOkResponse({ type: PublicPreferencesResponseDto })
  updatePreferences(@Req() request: PublicSupportRequest, @Body() dto: UpdatePublicPreferencesDto) {
    return this.preferences.update(requirePublicPrincipal(request), dto);
  }
}
