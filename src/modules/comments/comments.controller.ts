/**
 * ============================================================================
 * FICHIER : src/modules/comments/comments.controller.ts
 * RÔLE : Contrôleur REST de gestion des commentaires publics d'incidents.
 * EXPLICATION :
 * Ce contrôleur gère la communication publique autour d'un ticket :
 * 1. `GET /tickets/:ticketId/comments` : Liste paginée chronologique des échanges publics sur un ticket visible.
 * 2. `POST /tickets/:ticketId/comments` : Création d'un commentaire public par tout agent autorisé.
 * 3. `PATCH /comments/:id` & `DELETE /comments/:id` : Modification et suppression restreintes à l'auteur du commentaire, un `SUPERVISOR` ou un `ADMINISTRATOR`.
 * ============================================================================
 */

import { Controller, Get, Post, Patch, Delete, Body, Param, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery, ApiBody } from '@nestjs/swagger';
import { CommentsService } from './comments.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';

/**
 * Contrôleur d'API pour les échanges et commentaires publics sur les tickets.
 */
@ApiTags('comments')
@ApiBearerAuth()
@Controller()
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  /**
   * Récupère la liste paginée des commentaires publics enregistrés sur un ticket.
   *
   * @param ticketId Identifiant UUIDv7 du ticket d'incident.
   * @param pagination Paramètres de pagination (`page`, `limit`).
   * @param user Utilisateur authentifié (contrôle de visibilité du ticket).
   */
  @Get('tickets/:ticketId/comments')
  @ApiOperation({
    summary: "Commentaires publics d'un ticket",
    description:
      "Retourne la liste paginée des commentaires publics d'un ticket, triés par date de création (chronologique).\n\n**Rôles autorisés :** tous les utilisateurs authentifiés.",
  })
  @ApiParam({ name: 'ticketId', description: 'UUID du ticket', example: '01922b3c-d4e5-7f8a-9b1c-2d3e4f5a6b7c' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1, description: 'Page courante' })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20, description: 'Éléments par page (max 100)' })
  @ApiQuery({
    name: 'order',
    required: false,
    enum: ['asc', 'desc'],
    example: 'asc',
    description: 'Ordre chronologique',
  })
  @ApiResponse({ status: 200, description: 'Liste paginée des commentaires publics.' })
  @ApiResponse({ status: 401, description: 'Token JWT manquant ou expiré.' })
  @ApiResponse({ status: 404, description: 'Ticket non trouvé.' })
  async findAll(
    @Param('ticketId') ticketId: string,
    @Query() pagination: PaginationDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.commentsService.findAll(ticketId, user, pagination.page, pagination.limit);
  }

  /**
   * Ajoute un nouveau commentaire public sur le ticket spécifié.
   *
   * @param ticketId Identifiant UUID du ticket.
   * @param dto Contenu textuel du commentaire (1 à 5000 caractères).
   * @param user Utilisateur auteur.
   */
  @Post('tickets/:ticketId/comments')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Ajouter un commentaire public',
    description:
      'Ajoute un commentaire public sur un ticket. Le commentaire est visible par tous les utilisateurs.\n\n**Rôles autorisés :** tous les utilisateurs authentifiés.',
  })
  @ApiParam({ name: 'ticketId', description: 'UUID du ticket concerné' })
  @ApiBody({
    type: CreateCommentDto,
    examples: { default: { value: { content: 'Information complémentaire sur la panne en cours.' } } },
  })
  @ApiResponse({ status: 201, description: 'Commentaire créé avec succès.' })
  @ApiResponse({ status: 400, description: 'Contenu vide ou invalide.' })
  @ApiResponse({ status: 401, description: 'Non authentifié.' })
  @ApiResponse({ status: 404, description: 'Ticket non trouvé.' })
  async create(@Param('ticketId') ticketId: string, @Body() dto: CreateCommentDto, @CurrentUser() user: JwtPayload) {
    return dto.correctsCommentId
      ? this.commentsService.create(ticketId, user, dto.content, dto.correctsCommentId)
      : this.commentsService.create(ticketId, user, dto.content);
  }

  /**
   * Modifie le texte d'un commentaire public existant.
   *
   * @param id Identifiant UUID du commentaire.
   * @param dto Nouveau texte.
   * @param user Utilisateur demandeur.
   */
  @Patch('comments/:id')
  @ApiOperation({
    summary: 'Modifier un commentaire',
    description:
      "Modifie le contenu d'un commentaire existant. Seul l'auteur du commentaire ou un ADMINISTRATOR/SUPERVISOR peut le modifier.\n\n**Rôles autorisés :** auteur du commentaire, ADMINISTRATOR, SUPERVISOR",
  })
  @ApiParam({ name: 'id', description: 'UUID du commentaire' })
  @ApiBody({ type: UpdateCommentDto })
  @ApiResponse({ status: 200, description: 'Commentaire mis à jour avec succès.' })
  @ApiResponse({ status: 400, description: 'Contenu vide ou invalide.' })
  @ApiResponse({ status: 401, description: 'Non authentifié.' })
  @ApiResponse({ status: 403, description: "Vous n'êtes pas l'auteur du commentaire." })
  @ApiResponse({ status: 404, description: 'Commentaire non trouvé.' })
  async update(@Param('id') id: string, @Body() dto: UpdateCommentDto, @CurrentUser() user: JwtPayload) {
    return this.commentsService.update(id, user, dto.content);
  }

  /**
   * Supprime un commentaire public.
   *
   * @param id Identifiant UUID du commentaire.
   * @param user Utilisateur demandeur.
   */
  @Delete('comments/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Supprimer un commentaire',
    description:
      "Supprime un commentaire. Seul l'auteur ou un ADMINISTRATOR/SUPERVISOR peut le supprimer.\n\n**Rôles autorisés :** auteur du commentaire, ADMINISTRATOR, SUPERVISOR",
  })
  @ApiParam({ name: 'id', description: 'UUID du commentaire à supprimer' })
  @ApiResponse({ status: 204, description: 'Commentaire supprimé avec succès.' })
  @ApiResponse({ status: 401, description: 'Non authentifié.' })
  @ApiResponse({ status: 403, description: "Vous n'êtes pas l'auteur du commentaire." })
  @ApiResponse({ status: 404, description: 'Commentaire non trouvé.' })
  async remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    await this.commentsService.remove(id, user);
  }
}
