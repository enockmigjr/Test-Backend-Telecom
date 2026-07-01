import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery, ApiBody } from '@nestjs/swagger';

import { TicketsService } from './services/tickets.service';
import { TicketsSearchService } from './services/tickets-search.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { SearchTicketsDto } from './dto/search-tickets.dto';
import { AssignTicketDto } from './dto/assign-ticket.dto';
import { EscalateTicketDto } from './dto/escalate-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { Idempotent } from '../../common/decorators/idempotent.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { RolesGuard } from '../auth/guards/roles.guard';
import { FieldProjectionInterceptor } from '../../common/interceptors/field-projection.interceptor';

@ApiTags('tickets')
@ApiBearerAuth()
@Controller('tickets')
@UseGuards(RolesGuard)
export class TicketsController {
  constructor(
    private readonly ticketsService: TicketsService,
    private readonly searchService: TicketsSearchService,
  ) {}

  @Post()
  @Idempotent()
  @Roles(
    'ADMINISTRATOR',
    'SUPERVISOR',
    'CUSTOMER_SERVICE_AGENT',
    'NOC_ENGINEER',
    'BILLING_AGENT',
    'TECHNICAL_SUPPORT_ENGINEER',
    'FIELD_TECHNICIAN',
  )
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: "Créer un ticket d'incident",
    description:
      "Crée un nouveau ticket. L'ID d'idempotence (`Idempotency-Key`) dans les headers évite les doublons lors des soumissions multiples.\n\nLe SLA est calculé automatiquement selon la catégorie et la priorité.\n\n**Rôles autorisés :** Tous les rôles authentifiés",
  })
  @ApiBody({ type: CreateTicketDto })
  @ApiResponse({
    status: 201,
    description: 'Ticket créé. La réponse inclut le numéro généré (TT-YYYY-XXXXXX) et les échéances SLA.',
  })
  @ApiResponse({ status: 400, description: 'Données invalides ou politique SLA introuvable pour catégorie/priorité.' })
  @ApiResponse({ status: 401, description: 'Non authentifié.' })
  @ApiResponse({ status: 429, description: 'Limite de requêtes dépassée.' })
  async create(@Body() dto: CreateTicketDto, @CurrentUser() user: JwtPayload) {
    return this.ticketsService.create(dto, user.sub);
  }

  @Get()
  @UseInterceptors(FieldProjectionInterceptor)
  @ApiOperation({
    summary: 'Rechercher des tickets',
    description:
      'Recherche multi-critères sur les tickets. Supports la pagination.\n\nParam `?detail=summary` retourne uniquement les champs essentiels (id, numéro, titre, statut, priorité).\n\n**Rôles autorisés :** Tous les rôles authentifiés',
  })
  @ApiQuery({ name: 'status', required: false, example: 'IN_PROGRESS', description: 'Filtrer par statut du ticket' })
  @ApiQuery({ name: 'priority', required: false, example: 'HIGH', description: 'Filtrer par priorité' })
  @ApiQuery({ name: 'category', required: false, example: 'NETWORK', description: 'Filtrer par catégorie' })
  @ApiQuery({ name: 'assignedTo', required: false, description: "UUID de l'agent assigné" })
  @ApiQuery({ name: 'departmentId', required: false, description: 'UUID du département' })
  @ApiQuery({ name: 'slaBreached', required: false, type: Boolean, description: 'Filtrer les tickets en breach SLA' })
  @ApiQuery({ name: 'q', required: false, description: 'Recherche textuelle (titre, numéro)' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'detail', required: false, enum: ['full', 'summary'], description: 'summary = champs réduits' })
  @ApiResponse({ status: 200, description: 'Liste paginée des tickets correspondant aux filtres.' })
  @ApiResponse({ status: 401, description: 'Non authentifié.' })
  async search(@Query() filters: SearchTicketsDto) {
    return this.searchService.search(filters);
  }

  @Get(':id')
  @ApiOperation({
    summary: "Détails d'un ticket",
    description:
      "Retourne un ticket par son UUID.\n\nAvec `?detail=full`, enrichit la réponse avec le comptage des commentaires et l'historique des assignations.\n\n**Rôles autorisés :** Tous les rôles authentifiés",
  })
  @ApiParam({ name: 'id', description: 'UUID du ticket' })
  @ApiQuery({
    name: 'detail',
    required: false,
    enum: ['full', 'summary'],
    description: 'full = ticket + commentaires + historique assignations',
  })
  @ApiResponse({ status: 200, description: 'Ticket avec ses relations (créateur, assigné, département).' })
  @ApiResponse({ status: 401, description: 'Non authentifié.' })
  @ApiResponse({ status: 404, description: 'Ticket non trouvé ou supprimé.' })
  async findOne(@Param('id') id: string, @Query('detail') detail?: string) {
    if (detail === 'full') {
      return this.ticketsService.findByIdDetailed(id);
    }
    return this.ticketsService.findById(id);
  }

  @Patch(':id')
  @Roles('ADMINISTRATOR', 'SUPERVISOR')
  @ApiOperation({ summary: 'Mettre à jour un ticket' })
  async update(@Param('id') id: string, @Body() dto: UpdateTicketDto, @CurrentUser() user: JwtPayload) {
    return this.ticketsService.update(id, dto, user.sub);
  }

  @Post(':id/assign')
  @Idempotent()
  @Roles('ADMINISTRATOR', 'SUPERVISOR')
  @ApiOperation({ summary: 'Assigner un ticket à un agent — idempotent (header Idempotency-Key)' })
  async assign(@Param('id') id: string, @Body() dto: AssignTicketDto, @CurrentUser() user: JwtPayload) {
    return this.ticketsService.assign(id, dto.userId, user.sub, dto.reason);
  }

  @Post(':id/escalate')
  @Idempotent()
  @Roles('ADMINISTRATOR', 'SUPERVISOR')
  @ApiOperation({ summary: 'Escalader un ticket — idempotent (header Idempotency-Key)' })
  async escalate(@Param('id') id: string, @Body() dto: EscalateTicketDto, @CurrentUser() user: JwtPayload) {
    return this.ticketsService.escalate(id, dto.userId, dto.departmentId, user.sub, dto.reason);
  }

  @Post(':id/resolve')
  @Roles(
    'ADMINISTRATOR',
    'SUPERVISOR',
    'CUSTOMER_SERVICE_AGENT',
    'NOC_ENGINEER',
    'BILLING_AGENT',
    'TECHNICAL_SUPPORT_ENGINEER',
    'FIELD_TECHNICIAN',
  )
  @ApiOperation({ summary: 'Marquer un ticket comme résolu' })
  async resolve(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.ticketsService.changeStatus(id, 'RESOLVED', user.sub);
  }

  @Post(':id/close')
  @Roles('ADMINISTRATOR', 'SUPERVISOR')
  @ApiOperation({ summary: 'Clôturer un ticket résolu' })
  async close(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.ticketsService.changeStatus(id, 'CLOSED', user.sub);
  }

  @Post(':id/reopen')
  @Roles('ADMINISTRATOR', 'SUPERVISOR')
  @ApiOperation({ summary: 'Réouvrir un ticket clôturé' })
  async reopen(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.ticketsService.changeStatus(id, 'REOPENED', user.sub);
  }

  @Get(':id/history')
  @ApiOperation({ summary: "Historique complet d'un ticket" })
  async history(@Param('id') id: string) {
    return this.ticketsService.getHistory(id);
  }

  @Delete(':id')
  @Roles('ADMINISTRATOR')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Supprimer un ticket (soft delete, Admin uniquement)' })
  async remove(@Param('id') id: string) {
    await this.ticketsService.softDelete(id);
  }
}
