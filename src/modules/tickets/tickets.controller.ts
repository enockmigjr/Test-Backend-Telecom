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
      "Crée un nouveau ticket. L'ID d'idempotence (Idempotency-Key) dans les headers évite les doublons lors des soumissions multiples.\n\nLe SLA est calculé automatiquement selon la catégorie et la priorité.\n\n**Rôles autorisés :** Tous les rôles authentifiés",
  })
  @ApiBody({ type: CreateTicketDto })
  @ApiResponse({
    status: 201,
    description: 'Ticket créé. La réponse inclut le numéro généré (TT-YYYY-XXXXXX) et les échéances SLA.',
  })
  @ApiResponse({ status: 400, description: 'Données invalides ou politique SLA introuvable pour catégorie/priorité.' })
  @ApiResponse({ status: 401, description: 'Token JWT manquant ou expiré.' })
  @ApiResponse({ status: 429, description: 'Limite de requêtes dépassée.' })
  async create(@Body() dto: CreateTicketDto, @CurrentUser() user: JwtPayload) {
    return this.ticketsService.create(dto, user.sub);
  }

  @Get()
  @UseInterceptors(FieldProjectionInterceptor)
  @ApiOperation({
    summary: 'Rechercher des tickets',
    description:
      'Recherche multi-critères sur les tickets. Supports la pagination.\n\nParam detail=summary retourne uniquement les champs essentiels (id, numéro, titre, statut, priorité).\n\n**Rôles autorisés :** Tous les rôles authentifiés',
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
  @ApiResponse({ status: 400, description: 'Paramètres de filtrage invalides.' })
  @ApiResponse({ status: 401, description: 'Token JWT manquant ou expiré.' })
  @ApiResponse({ status: 403, description: 'Rôle insuffisant.' })
  @ApiResponse({ status: 429, description: 'Limite de requêtes dépassée.' })
  async search(@Query() filters: SearchTicketsDto) {
    return this.searchService.search(filters);
  }

  @Get(':id')
  @ApiOperation({
    summary: "Détails d'un ticket",
    description:
      "Retourne un ticket par son UUID.\n\nAvec detail=full, enrichit la réponse avec le comptage des commentaires et l'historique des assignations.\n\n**Rôles autorisés :** Tous les rôles authentifiés",
  })
  @ApiParam({ name: 'id', description: 'UUID du ticket', example: '01922b3c-...' })
  @ApiQuery({
    name: 'detail',
    required: false,
    enum: ['full', 'summary'],
    description: 'full = ticket + commentaires + historique assignations',
  })
  @ApiResponse({ status: 200, description: 'Ticket avec ses relations (créateur, assigné, département).' })
  @ApiResponse({ status: 401, description: 'Token JWT manquant ou expiré.' })
  @ApiResponse({ status: 404, description: 'Ticket non trouvé ou supprimé.' })
  @ApiResponse({ status: 429, description: 'Limite de requêtes dépassée.' })
  async findOne(@Param('id') id: string, @Query('detail') detail?: string) {
    if (detail === 'full') {
      return this.ticketsService.findByIdDetailed(id);
    }
    return this.ticketsService.findById(id);
  }

  @Patch(':id')
  @Roles('ADMINISTRATOR', 'SUPERVISOR')
  @ApiOperation({
    summary: 'Mettre à jour un ticket',
    description:
      "Met à jour les champs modifiables d'un ticket (titre, description, priorité, catégorie).\n\n**Rôles autorisés :** ADMINISTRATOR, SUPERVISOR",
  })
  @ApiParam({ name: 'id', description: 'UUID du ticket' })
  @ApiBody({ type: UpdateTicketDto })
  @ApiResponse({ status: 200, description: 'Ticket mis à jour avec succès.' })
  @ApiResponse({ status: 400, description: 'Données invalides ou transition de statut interdite.' })
  @ApiResponse({ status: 401, description: 'Token JWT manquant ou expiré.' })
  @ApiResponse({ status: 403, description: 'Rôle insuffisant -- ADMINISTRATOR ou SUPERVISOR requis.' })
  @ApiResponse({ status: 404, description: 'Ticket non trouvé.' })
  @ApiResponse({ status: 409, description: 'Conflit -- transition de statut non autorisée.' })
  @ApiResponse({ status: 429, description: 'Limite de requêtes dépassée.' })
  async update(@Param('id') id: string, @Body() dto: UpdateTicketDto, @CurrentUser() user: JwtPayload) {
    return this.ticketsService.update(id, dto, user.sub);
  }

  @Post(':id/assign')
  @Idempotent()
  @HttpCode(HttpStatus.OK)
  @Roles('ADMINISTRATOR', 'SUPERVISOR')
  @ApiOperation({
    summary: 'Assigner un ticket à un agent -- idempotent (header Idempotency-Key)',
    description:
      "Assigne un ticket à un agent spécifique. L'idempotence via Idempotency-Key empêche les assignations multiples frauduleuses.\n\n**Rôles autorisés :** ADMINISTRATOR, SUPERVISOR",
  })
  @ApiParam({ name: 'id', description: 'UUID du ticket' })
  @ApiBody({ type: AssignTicketDto })
  @ApiResponse({ status: 200, description: 'Ticket assigné avec succès.' })
  @ApiResponse({ status: 400, description: "Données invalides ou ticket déjà assigné à l'utilisateur." })
  @ApiResponse({ status: 401, description: 'Token JWT manquant ou expiré.' })
  @ApiResponse({ status: 403, description: 'Rôle insuffisant -- ADMINISTRATOR ou SUPERVISOR requis.' })
  @ApiResponse({ status: 404, description: 'Ticket ou utilisateur non trouvé.' })
  @ApiResponse({ status: 409, description: 'Conflit -- assignation incompatible avec le statut actuel.' })
  @ApiResponse({ status: 429, description: 'Limite de requêtes dépassée.' })
  async assign(@Param('id') id: string, @Body() dto: AssignTicketDto, @CurrentUser() user: JwtPayload) {
    return this.ticketsService.assign(id, dto.userId, user.sub, dto.reason);
  }

  @Post(':id/escalate')
  @Idempotent()
  @HttpCode(HttpStatus.OK)
  @Roles('ADMINISTRATOR', 'SUPERVISOR')
  @ApiOperation({
    summary: 'Escalader un ticket -- idempotent (header Idempotency-Key)',
    description:
      "Escalade un ticket vers un autre département ou un autre agent. Utile quand le niveau de support actuel ne peut pas résoudre le problème.\n\n**Rôles autorisés :** ADMINISTRATOR, SUPERVISOR",
  })
  @ApiParam({ name: 'id', description: 'UUID du ticket' })
  @ApiBody({ type: EscalateTicketDto })
  @ApiResponse({ status: 200, description: 'Ticket escaladé avec succès.' })
  @ApiResponse({ status: 400, description: "Données invalides ou transition d'escalade interdite." })
  @ApiResponse({ status: 401, description: 'Token JWT manquant ou expiré.' })
  @ApiResponse({ status: 403, description: 'Rôle insuffisant -- ADMINISTRATOR ou SUPERVISOR requis.' })
  @ApiResponse({ status: 404, description: 'Ticket, département ou utilisateur cible non trouvé.' })
  @ApiResponse({ status: 409, description: 'Conflit -- escalade incompatible avec le statut actuel.' })
  @ApiResponse({ status: 429, description: 'Limite de requêtes dépassée.' })
  async escalate(@Param('id') id: string, @Body() dto: EscalateTicketDto, @CurrentUser() user: JwtPayload) {
    return this.ticketsService.escalate(id, dto.userId, dto.departmentId, user.sub, dto.reason);
  }

  @Post(':id/start')
  @HttpCode(HttpStatus.OK)
  @Roles(
    'ADMINISTRATOR',
    'SUPERVISOR',
    'CUSTOMER_SERVICE_AGENT',
    'NOC_ENGINEER',
    'BILLING_AGENT',
    'TECHNICAL_SUPPORT_ENGINEER',
    'FIELD_TECHNICIAN',
  )
  @ApiOperation({
    summary: "Démarrer le traitement d'un ticket (ASSIGNED -> IN_PROGRESS)",
    description:
      "Fait passer le statut du ticket de ASSIGNED à IN_PROGRESS, indiquant que l'agent a commencé à travailler sur le ticket.\n\n**Rôles autorisés :** Tous les rôles authentifiés (avec accès au ticket)",
  })
  @ApiParam({ name: 'id', description: 'UUID du ticket' })
  @ApiResponse({ status: 200, description: 'Ticket en cours de traitement (IN_PROGRESS).' })
  @ApiResponse({ status: 400, description: 'Transition invalide -- le statut actuel ne permet pas ce changement.' })
  @ApiResponse({ status: 401, description: 'Token JWT manquant ou expiré.' })
  @ApiResponse({ status: 403, description: 'Rôle insuffisant.' })
  @ApiResponse({ status: 404, description: 'Ticket non trouvé.' })
  @ApiResponse({ status: 409, description: 'Conflit -- transition non autorisée.' })
  @ApiResponse({ status: 429, description: 'Limite de requêtes dépassée.' })
  async start(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.ticketsService.changeStatus(id, 'IN_PROGRESS', user.sub);
  }

  @Post(':id/resolve')
  @HttpCode(HttpStatus.OK)
  @Roles(
    'ADMINISTRATOR',
    'SUPERVISOR',
    'CUSTOMER_SERVICE_AGENT',
    'NOC_ENGINEER',
    'BILLING_AGENT',
    'TECHNICAL_SUPPORT_ENGINEER',
    'FIELD_TECHNICIAN',
  )
  @ApiOperation({
    summary: 'Marquer un ticket comme résolu (IN_PROGRESS -> RESOLVED)',
    description:
      "Fait passer le statut du ticket de IN_PROGRESS à RESOLVED. Le ticket sera ensuite vérifié avant clôture.\n\n**Rôles autorisés :** Tous les rôles authentifiés (avec accès au ticket)",
  })
  @ApiParam({ name: 'id', description: 'UUID du ticket' })
  @ApiResponse({ status: 200, description: 'Ticket marqué comme résolu (RESOLVED).' })
  @ApiResponse({ status: 400, description: 'Transition invalide.' })
  @ApiResponse({ status: 401, description: 'Token JWT manquant ou expiré.' })
  @ApiResponse({ status: 403, description: 'Rôle insuffisant.' })
  @ApiResponse({ status: 404, description: 'Ticket non trouvé.' })
  @ApiResponse({ status: 409, description: 'Conflit -- transition non autorisée.' })
  @ApiResponse({ status: 429, description: 'Limite de requêtes dépassée.' })
  async resolve(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.ticketsService.changeStatus(id, 'RESOLVED', user.sub);
  }

  @Post(':id/close')
  @HttpCode(HttpStatus.OK)
  @Roles('ADMINISTRATOR', 'SUPERVISOR')
  @ApiOperation({
    summary: "Clôturer un ticket résolu (RESOLVED -> CLOSED)",
    description:
      "Ferme définitivement un ticket résolu. Seuls ADMINISTRATOR et SUPERVISOR peuvent clôturer.\n\n**Rôles autorisés :** ADMINISTRATOR, SUPERVISOR",
  })
  @ApiParam({ name: 'id', description: 'UUID du ticket' })
  @ApiResponse({ status: 200, description: 'Ticket clôturé (CLOSED).' })
  @ApiResponse({ status: 400, description: 'Transition invalide -- le ticket doit être en statut RESOLVED.' })
  @ApiResponse({ status: 401, description: 'Token JWT manquant ou expiré.' })
  @ApiResponse({ status: 403, description: 'Rôle insuffisant -- ADMINISTRATOR ou SUPERVISOR requis.' })
  @ApiResponse({ status: 404, description: 'Ticket non trouvé.' })
  @ApiResponse({ status: 409, description: 'Conflit -- transition non autorisée.' })
  @ApiResponse({ status: 429, description: 'Limite de requêtes dépassée.' })
  async close(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.ticketsService.changeStatus(id, 'CLOSED', user.sub);
  }

  @Post(':id/reopen')
  @HttpCode(HttpStatus.OK)
  @Roles('ADMINISTRATOR', 'SUPERVISOR')
  @ApiOperation({
    summary: "Réouvrir un ticket clôturé (CLOSED -> REOPENED)",
    description:
      "Réouvre un ticket précédemment clôturé, généralement parce que le problème n'est pas entièrement résolu.\n\n**Rôles autorisés :** ADMINISTRATOR, SUPERVISOR",
  })
  @ApiParam({ name: 'id', description: 'UUID du ticket' })
  @ApiResponse({ status: 200, description: 'Ticket réouvert (REOPENED).' })
  @ApiResponse({ status: 400, description: 'Transition invalide -- le ticket doit être en statut CLOSED.' })
  @ApiResponse({ status: 401, description: 'Token JWT manquant ou expiré.' })
  @ApiResponse({ status: 403, description: 'Rôle insuffisant -- ADMINISTRATOR ou SUPERVISOR requis.' })
  @ApiResponse({ status: 404, description: 'Ticket non trouvé.' })
  @ApiResponse({ status: 409, description: 'Conflit -- transition non autorisée.' })
  @ApiResponse({ status: 429, description: 'Limite de requêtes dépassée.' })
  async reopen(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.ticketsService.changeStatus(id, 'REOPENED', user.sub);
  }

  @Get(':id/history')
  @ApiOperation({
    summary: "Historique complet d'un ticket",
    description:
      "Retourne l'historique complet des changements de statut, assignations et escalades pour un ticket.\n\n**Rôles autorisés :** Tous les rôles authentifiés",
  })
  @ApiParam({ name: 'id', description: 'UUID du ticket' })
  @ApiResponse({ status: 200, description: 'Historique des événements du ticket.' })
  @ApiResponse({ status: 401, description: 'Token JWT manquant ou expiré.' })
  @ApiResponse({ status: 404, description: 'Ticket non trouvé.' })
  @ApiResponse({ status: 429, description: 'Limite de requêtes dépassée.' })
  async history(@Param('id') id: string) {
    return this.ticketsService.getHistory(id);
  }

  @Delete(':id')
  @Roles('ADMINISTRATOR')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Supprimer un ticket (soft delete, Admin uniquement)',
    description:
      "Effectue une suppression logique (soft delete) du ticket. Le ticket n'est pas effacé de la base de données mais marqué comme supprimé.\n\n**Rôles autorisés :** ADMINISTRATOR uniquement",
  })
  @ApiParam({ name: 'id', description: 'UUID du ticket' })
  @ApiResponse({ status: 204, description: 'Ticket supprimé (soft delete).' })
  @ApiResponse({ status: 401, description: 'Token JWT manquant ou expiré.' })
  @ApiResponse({ status: 403, description: 'Rôle insuffisant -- ADMINISTRATOR requis.' })
  @ApiResponse({ status: 404, description: 'Ticket non trouvé.' })
  @ApiResponse({ status: 409, description: 'Conflit -- le ticket a des dépendances qui empêchent la suppression.' })
  @ApiResponse({ status: 429, description: 'Limite de requêtes dépassée.' })
  async remove(@Param('id') id: string) {
    await this.ticketsService.softDelete(id);
  }
}
