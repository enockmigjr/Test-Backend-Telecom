/**
 * ============================================================================
 * FICHIER : src/modules/tickets/tickets.controller.ts
 * RÔLE : Contrôleur REST d'exposition des routes de gestion des tickets (`/api/v1/tickets`).
 * EXPLICATION :
 * Ce contrôleur gère toutes les interactions REST relatives aux tickets d'incidents télécom :
 * 1. Création, mise à jour, recherche multi-critères et consultation détaillée de tickets.
 * 2. Workflow d'assignation, de réassignation et d'escalade fonctionnelle ou hiérarchique.
 * 3. Transitions de statut (démarrage, mise en attente client/tiers, résolution, clôture, réouverture).
 * 4. Suppression logique (soft delete réservé aux administrateurs) et consultation d'historique.
 * ============================================================================
 */

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
import { TicketDetailsService } from './services/ticket-details.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { SearchTicketsDto } from './dto/search-tickets.dto';
import { AssignTicketDto } from './dto/assign-ticket.dto';
import { EscalateTicketDto } from './dto/escalate-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { ResolveTicketDto } from './dto/resolve-ticket.dto';
import { ReopenTicketDto } from './dto/reopen-ticket.dto';
import { PendingTicketDto } from './dto/pending-ticket.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { Idempotent } from '../../common/decorators/idempotent.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { RolesGuard } from '../auth/guards/roles.guard';
import { DepartmentAbacGuard } from '../../common/guards/department-abac.guard';
import { FieldProjectionInterceptor } from '../../common/interceptors/field-projection.interceptor';

/**
 * Contrôleur REST exposant l'ensemble des fonctionnalités du système de tickets télécom.
 */
@ApiTags('tickets')
@ApiBearerAuth()
@Controller('tickets')
@UseGuards(RolesGuard, DepartmentAbacGuard)
export class TicketsController {
  constructor(
    private readonly ticketsService: TicketsService,
    private readonly searchService: TicketsSearchService,
    private readonly ticketDetails: TicketDetailsService,
  ) {}

  /**
   * Endpoint POST /tickets : Crée un nouveau ticket d'incident.
   *
   * @param dto Corps de la requête contenant les informations du ticket.
   * @param user Utilisateur authentifié créateur du ticket.
   * @returns Le ticket créé.
   */
  @Post()
  @Idempotent()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: "Créer un ticket d'incident",
    description:
      'Crée un nouveau ticket. Le SLA est calculé automatiquement selon la catégorie et la priorité.\n\n**Rôles autorisés :** Tous les rôles authentifiés',
  })
  @ApiBody({ type: CreateTicketDto })
  @ApiResponse({
    status: 201,
    description: 'Ticket créé.',
  })
  async create(@Body() dto: CreateTicketDto, @CurrentUser() user: JwtPayload) {
    return this.ticketsService.create(dto, user.sub);
  }

  /**
   * Endpoint GET /tickets : Recherche multi-critères paginée avec filtrage selon le rôle.
   *
   * @param filters Critères de filtrage et pagination.
   * @param user Utilisateur effectuant la recherche.
   * @returns Liste paginée de tickets autorisés.
   */
  @Get()
  @UseInterceptors(FieldProjectionInterceptor)
  @ApiOperation({
    summary: 'Rechercher des tickets',
    description: "Recherche multi-critères avec pagination sur les tickets visibles selon le rôle de l'utilisateur.",
  })
  @ApiQuery({ name: 'status', required: false, description: 'Filtrer par statut (ex: NEW, ASSIGNED, IN_PROGRESS)' })
  @ApiQuery({ name: 'priority', required: false, description: 'Filtrer par priorité (LOW, MEDIUM, HIGH, CRITICAL)' })
  @ApiQuery({ name: 'severity', required: false, description: 'Filtrer par sévérité' })
  @ApiQuery({ name: 'category', required: false, description: 'Filtrer par catégorie' })
  @ApiQuery({ name: 'assignedTo', required: false, description: "UUID de l'agent assigné" })
  @ApiQuery({ name: 'assignedTeam', required: false, description: 'UUID du département assigné' })
  @ApiQuery({ name: 'departmentId', required: false, description: 'UUID du département du ticket' })
  @ApiQuery({ name: 'search', required: false, description: 'Recherche texte libre (titre, description, numéro)' })
  @ApiQuery({ name: 'from', required: false, description: 'Date de début ISO 8601 (ex: 2026-01-01)' })
  @ApiQuery({ name: 'to', required: false, description: 'Date de fin ISO 8601' })
  @ApiQuery({ name: 'page', required: false, description: 'Page courante (défaut: 1)' })
  @ApiQuery({ name: 'limit', required: false, description: 'Résultats par page (défaut: 20, max: 100)' })
  @ApiQuery({ name: 'sort', required: false, description: 'Champ de tri (ex: createdAt, priority)' })
  @ApiQuery({ name: 'order', required: false, description: 'Ordre de tri: asc | desc' })
  @ApiResponse({ status: 200, description: 'Liste paginée de tickets.' })
  async search(@Query() filters: SearchTicketsDto, @CurrentUser() user: JwtPayload) {
    return this.searchService.search(filters, user);
  }

  /**
   * Endpoint GET /tickets/:id : Récupère les informations simples ou détaillées d'un ticket.
   *
   * @param id Identifiant UUIDv7 du ticket.
   * @param detail Si égal à 'full', retourne les jointures détaillées et l'historique d'assignation.
   * @param assignmentPage Numéro de page d'assignation si detail=full.
   * @param assignmentLimit Limite de pagination d'assignation si detail=full.
   */
  @Get(':id')
  @ApiOperation({
    summary: "Détails d'un ticket",
    description:
      "Retourne un ticket par son UUID. Avec ?detail=full, ajoute l'historique pagine des assignations et les compteurs de relations.",
  })
  @ApiParam({ name: 'id', description: 'UUID du ticket' })
  @ApiQuery({ name: 'detail', required: false, description: "Option 'full' pour retourner les relations détaillées" })
  @ApiResponse({ status: 200, description: 'Détails du ticket.' })
  @ApiResponse({ status: 404, description: 'Ticket introuvable.' })
  async findOne(
    @Param('id') id: string,
    @Query('detail') detail?: string,
    @Query('assignmentPage') assignmentPage?: string,
    @Query('assignmentLimit') assignmentLimit?: string,
  ) {
    if (detail === 'full') {
      return this.ticketDetails.findById(id, Number(assignmentPage ?? 1), Number(assignmentLimit ?? 20));
    }
    return this.ticketsService.findById(id);
  }

  /**
   * Endpoint PATCH /tickets/:id : Met à jour partiellement un ticket d'incident.
   *
   * @param id Identifiant du ticket.
   * @param dto Champs à modifier.
   * @param user Utilisateur effectuant la modification.
   */
  @Patch(':id')
  @ApiOperation({
    summary: 'Mettre à jour un ticket',
    description:
      "Met à jour les champs modifiables d'un ticket. Les permissions d'édition sont validées dynamiquement selon l'ownership du champ.",
  })
  @ApiParam({ name: 'id', description: 'UUID du ticket' })
  @ApiBody({ type: UpdateTicketDto })
  @ApiResponse({ status: 200, description: 'Ticket mis à jour.' })
  @ApiResponse({ status: 400, description: 'Données invalides.' })
  @ApiResponse({ status: 403, description: 'Permission refusée.' })
  @ApiResponse({ status: 404, description: 'Ticket introuvable.' })
  async update(@Param('id') id: string, @Body() dto: UpdateTicketDto, @CurrentUser() user: JwtPayload) {
    return this.ticketsService.update(id, dto, user);
  }

  /**
   * Endpoint POST /tickets/:id/assign : Assigne un ticket à un agent.
   *
   * @param id Identifiant du ticket.
   * @param dto Identifiant de l'agent cible et raison facultative.
   * @param user Agent ou superviseur attribuant le ticket.
   */
  @Post(':id/assign')
  @Idempotent()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Assigner un ticket à un agent',
    description:
      "Assigne ou auto-assigne un ticket. Un agent peut s'auto-assigner un ticket NEW non assigné. L'assignation à des tiers exige le rôle SUPERVISOR ou ADMINISTRATOR.",
  })
  @ApiParam({ name: 'id', description: 'UUID du ticket' })
  @ApiBody({ type: AssignTicketDto })
  @ApiResponse({ status: 200, description: 'Ticket assigné.' })
  @ApiResponse({ status: 403, description: 'Permission refusée.' })
  @ApiResponse({ status: 404, description: 'Ticket ou utilisateur introuvable.' })
  async assign(@Param('id') id: string, @Body() dto: AssignTicketDto, @CurrentUser() user: JwtPayload) {
    return this.ticketsService.assign(id, dto.userId, user, dto.reason);
  }

  /**
   * Endpoint POST /tickets/:id/reassign : Réassigne un ticket à un autre technicien.
   *
   * @param id Identifiant du ticket.
   * @param dto Nouvel agent cible et raison.
   * @param user Utilisateur effectuant la réassignation.
   */
  @Post(':id/reassign')
  @Idempotent()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Réassigner un ticket à un autre agent',
    description:
      "Réassigne un ticket déjà assigné. Autorisé pour l'assigné actuel (escalade hiérarchique), un SUPERVISOR ou un ADMINISTRATOR.",
  })
  @ApiParam({ name: 'id', description: 'UUID du ticket' })
  @ApiBody({ type: AssignTicketDto })
  @ApiResponse({ status: 200, description: 'Ticket réassigné.' })
  @ApiResponse({ status: 403, description: 'Permission refusée.' })
  @ApiResponse({ status: 404, description: 'Ticket ou utilisateur introuvable.' })
  async reassign(@Param('id') id: string, @Body() dto: AssignTicketDto, @CurrentUser() user: JwtPayload) {
    return this.ticketsService.assign(id, dto.userId, user, dto.reason);
  }

  /**
   * Endpoint POST /tickets/:id/escalate : Escalade un ticket vers un nouveau département/agent.
   *
   * @param id Identifiant du ticket.
   * @param dto Agent et département cibles.
   * @param user Utilisateur déclenchant l'escalade.
   */
  @Post(':id/escalate')
  @Idempotent()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Escalader un ticket',
    description:
      "Escalade le ticket. L'escalade fonctionnelle (changement de département) exige SUPERVISOR ou ADMINISTRATOR. L'escalade hiérarchique (même département) est autorisée pour l'assigné actuel.",
  })
  @ApiParam({ name: 'id', description: 'UUID du ticket' })
  @ApiBody({ type: EscalateTicketDto })
  @ApiResponse({ status: 200, description: 'Ticket escaladé.' })
  @ApiResponse({ status: 403, description: 'Permission refusée.' })
  @ApiResponse({ status: 404, description: 'Ticket introuvable.' })
  async escalate(@Param('id') id: string, @Body() dto: EscalateTicketDto, @CurrentUser() user: JwtPayload) {
    return this.ticketsService.escalate(id, dto.userId, dto.departmentId, user, dto.reason);
  }

  /**
   * Endpoint POST /tickets/:id/start : Démarre le traitement d'un ticket (statut IN_PROGRESS).
   *
   * @param id Identifiant du ticket.
   * @param user Agent démarrant la prise en charge.
   */
  @Post(':id/start')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Démarrer le traitement d'un ticket",
    description:
      "Fait passer le statut du ticket à IN_PROGRESS (depuis ASSIGNED). Autorisé pour l'assigné, superviseur et admin.",
  })
  @ApiParam({ name: 'id', description: 'UUID du ticket' })
  @ApiResponse({ status: 200, description: 'Traitement démarré, statut: IN_PROGRESS.' })
  @ApiResponse({ status: 400, description: 'Transition de statut invalide.' })
  @ApiResponse({ status: 403, description: 'Permission refusée.' })
  async start(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.ticketsService.changeStatus(id, 'IN_PROGRESS', user);
  }

  /**
   * Endpoint POST /tickets/:id/resolve : Marque un ticket comme résolu avec synthèse.
   *
   * @param id Identifiant du ticket.
   * @param dto Résumé de la solution apportée.
   * @param user Agent résolvant l'incident.
   */
  @Post(':id/resolve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Marquer un ticket comme résolu',
    description:
      "Fait passer le statut du ticket à RESOLVED. Annule le job SLA breach planifié. Autorisé pour l'assigné, superviseur et admin.",
  })
  @ApiParam({ name: 'id', description: 'UUID du ticket' })
  @ApiBody({ type: ResolveTicketDto })
  @ApiResponse({ status: 200, description: 'Ticket résolu.' })
  @ApiResponse({ status: 400, description: 'Transition de statut invalide.' })
  @ApiResponse({ status: 403, description: 'Permission refusée.' })
  async resolve(@Param('id') id: string, @Body() dto: ResolveTicketDto, @CurrentUser() user: JwtPayload) {
    return this.ticketsService.changeStatus(id, 'RESOLVED', user, dto.resolutionSummary);
  }

  /**
   * Endpoint POST /tickets/:id/close : Clôture définitivement un ticket résolu.
   *
   * @param id Identifiant du ticket.
   * @param user Utilisateur clôturant le ticket.
   */
  @Post(':id/close')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Clôturer un ticket résolu',
    description:
      "Clôture définitivement un ticket résolu (RESOLVED → CLOSED). L'auto-clôture automatique ferme les tickets 48h après résolution. Autorisé pour l'assigné, superviseur et admin.",
  })
  @ApiParam({ name: 'id', description: 'UUID du ticket' })
  @ApiResponse({ status: 200, description: 'Ticket clôturé.' })
  @ApiResponse({ status: 400, description: 'Transition de statut invalide (ticket non résolu).' })
  @ApiResponse({ status: 403, description: 'Permission refusée.' })
  async close(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.ticketsService.changeStatus(id, 'CLOSED', user);
  }

  /**
   * Endpoint POST /tickets/:id/reopen : Réouvre un ticket fermé de moins de 30 jours.
   *
   * @param id Identifiant du ticket.
   * @param dto Motif explicatif de réouverture.
   * @param user Créateur, superviseur ou administrateur.
   */
  @Post(':id/reopen')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Réouvrir un ticket clôturé',
    description:
      'Réouvre un ticket fermé de moins de 30 jours. Autorisé pour le CS Agent créateur du ticket, SUPERVISOR et ADMINISTRATOR. Remettre à null resolvedAt et closedAt.',
  })
  @ApiParam({ name: 'id', description: 'UUID du ticket' })
  @ApiBody({ type: ReopenTicketDto })
  @ApiResponse({ status: 200, description: 'Ticket réouvert (statut: REOPENED).' })
  @ApiResponse({ status: 400, description: 'Délai de 30 jours dépassé ou raison trop courte (min 10 caractères).' })
  @ApiResponse({ status: 403, description: 'Permission refusée.' })
  async reopen(@Param('id') id: string, @Body() dto: ReopenTicketDto, @CurrentUser() user: JwtPayload) {
    return this.ticketsService.changeStatus(id, 'REOPENED', user, dto.reason);
  }

  /**
   * Endpoint POST /tickets/:id/pending-customer : Met le ticket en attente d'une information client (suspend le SLA).
   *
   * @param id Identifiant du ticket.
   * @param dto Raison de la mise en attente.
   * @param user Agent gérant le ticket.
   */
  @Post(':id/pending-customer')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Mettre en attente du client (IN_PROGRESS -> PENDING_CUSTOMER)',
    description: "Met le ticket en attente d'une action du client. Autorisé pour l'assigné, superviseur et admin.",
  })
  @ApiParam({ name: 'id', description: 'UUID du ticket' })
  @ApiBody({ type: PendingTicketDto })
  @ApiResponse({ status: 200, description: 'Ticket mis en attente client.' })
  @ApiResponse({ status: 400, description: 'Transition de statut invalide (ticket non IN_PROGRESS).' })
  @ApiResponse({ status: 403, description: 'Permission refusée.' })
  async pendingCustomer(@Param('id') id: string, @Body() dto: PendingTicketDto, @CurrentUser() user: JwtPayload) {
    return this.ticketsService.changeStatus(id, 'PENDING_CUSTOMER', user, dto.reason);
  }

  /**
   * Endpoint POST /tickets/:id/pending-third-party : Met le ticket en attente d'un sous-traitant (suspend le SLA).
   *
   * @param id Identifiant du ticket.
   * @param dto Raison de la mise en attente tiers.
   * @param user Agent gérant le ticket.
   */
  @Post(':id/pending-third-party')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Mettre en attente tiers (IN_PROGRESS -> PENDING_THIRD_PARTY)',
    description: "Met le ticket en attente d'un fournisseur ou tiers. Autorisé pour l'assigné, superviseur et admin.",
  })
  @ApiParam({ name: 'id', description: 'UUID du ticket' })
  @ApiBody({ type: PendingTicketDto })
  @ApiResponse({ status: 200, description: 'Ticket mis en attente tiers.' })
  @ApiResponse({ status: 400, description: 'Transition de statut invalide (ticket non IN_PROGRESS).' })
  @ApiResponse({ status: 403, description: 'Permission refusée.' })
  async pendingThirdParty(@Param('id') id: string, @Body() dto: PendingTicketDto, @CurrentUser() user: JwtPayload) {
    return this.ticketsService.changeStatus(id, 'PENDING_THIRD_PARTY', user, dto.reason);
  }

  /**
   * Endpoint GET /tickets/:id/history : Consulte l'historique complet d'un ticket.
   *
   * @param id Identifiant du ticket.
   */
  @Get(':id/history')
  @ApiOperation({
    summary: "Historique complet d'un ticket",
    description: "Retourne l'historique de toutes les transitions de statut et d'assignation du ticket.",
  })
  @ApiParam({ name: 'id', description: 'UUID du ticket' })
  @ApiResponse({ status: 200, description: 'Historique du ticket.' })
  @ApiResponse({ status: 404, description: 'Ticket introuvable.' })
  async history(@Param('id') id: string) {
    return this.ticketsService.getHistory(id);
  }

  /**
   * Endpoint DELETE /tickets/:id : Suppression logique d'un ticket (Administrateur uniquement).
   *
   * @param id Identifiant du ticket à archiver.
   */
  @Delete(':id')
  @Roles('ADMINISTRATOR')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Supprimer un ticket (soft delete, Admin uniquement)',
    description: 'Suppression logique du ticket. Le ticket reste en base avec deleted_at renseigné.',
  })
  @ApiParam({ name: 'id', description: 'UUID du ticket' })
  @ApiResponse({ status: 204, description: 'Ticket supprimé (soft delete).' })
  @ApiResponse({ status: 404, description: 'Ticket introuvable.' })
  async remove(@Param('id') id: string) {
    await this.ticketsService.softDelete(id);
  }
}
