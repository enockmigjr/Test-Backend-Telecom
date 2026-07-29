/**
 * ============================================================================
 * FICHIER : src/modules/notifications/notifications.controller.ts
 * RÔLE : Contrôleur REST de gestion de la boîte de réception des notifications utilisateur.
 * EXPLICATION :
 * Ce contrôleur expose les endpoints d'interaction avec les notifications personnelles (`/api/v1/notifications`) :
 * 1. `GET /` : Liste paginée de l'historique complet des notifications de l'utilisateur connecté (`user.sub`).
 * 2. `GET /unread` : Extrait uniquement les notifications non encore consultées (`isRead = false`).
 * 3. `PATCH /:id/read` : Marque une notification spécifique comme lue en horodatant `readAt`.
 * 4. `PATCH /read-all` : Marque l'ensemble des notifications de l'utilisateur comme lues en une seule transaction.
 * ============================================================================
 */

import { Controller, Get, Patch, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { RolesGuard } from '../auth/guards/roles.guard';

/**
 * Contrôleur d'API pour la boîte de réception et le statut de lecture des notifications.
 */
@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  /**
   * Récupère la liste paginée des notifications de l'utilisateur connecté.
   *
   * @param user Payload JWT de l'utilisateur courant.
   * @param p Paramètres de pagination.
   */
  @Get()
  @ApiOperation({
    summary: "Notifications de l'utilisateur connecté",
    description:
      "Retourne la liste paginée des notifications de l'utilisateur authentifié, triées par date de création (plus récentes d'abord).\n\n**Rôles autorisés :** tous les utilisateurs authentifiés.",
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1, description: 'Page courante' })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20, description: 'Éléments par page (max 100)' })
  @ApiResponse({
    status: 200,
    description: 'Liste paginée des notifications avec indicateur de lecture (isRead, readAt).',
  })
  @ApiResponse({ status: 401, description: 'Token JWT manquant ou expiré.' })
  async findAll(@CurrentUser() user: JwtPayload, @Query() p: PaginationDto) {
    return this.notificationsService.findAll(user.sub, p.page, p.limit);
  }

  /**
   * Récupère l'ensemble des notifications non lues de l'utilisateur authentifié.
   *
   * @param user Utilisateur connecté.
   */
  @Get('unread')
  @ApiOperation({
    summary: 'Notifications non lues',
    description:
      "Retourne la liste complète des notifications non lues de l'utilisateur connecté.\n\n**Rôles autorisés :** tous les utilisateurs authentifiés.",
  })
  @ApiResponse({ status: 200, description: 'Liste des notifications non lues (sans pagination).' })
  @ApiResponse({ status: 401, description: 'Non authentifié.' })
  async unread(@CurrentUser() user: JwtPayload) {
    return this.notificationsService.getUnread(user.sub);
  }

  /**
   * Marque une notification spécifique de l'utilisateur comme lue.
   *
   * @param id UUID de la notification.
   * @param user Utilisateur propriétaire.
   */
  @Patch(':id/read')
  @ApiOperation({
    summary: 'Marquer une notification comme lue',
    description:
      "Marque une notification spécifique comme lue. L'utilisateur ne peut marquer que ses propres notifications.\n\n**Rôles autorisés :** propriétaire de la notification.",
  })
  @ApiParam({ name: 'id', description: 'UUID de la notification' })
  @ApiResponse({ status: 200, description: 'Notification marquée comme lue.' })
  @ApiResponse({ status: 401, description: 'Non authentifié.' })
  @ApiResponse({ status: 404, description: 'Notification non trouvée ou accès refusé.' })
  async markRead(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.notificationsService.markAsRead(id, user.sub);
  }

  /**
   * Marque l'ensemble des notifications de l'utilisateur connecté comme lues.
   *
   * @param user Utilisateur courant.
   */
  @Patch('read-all')
  @ApiOperation({
    summary: 'Marquer toutes les notifications comme lues',
    description:
      "Marque toutes les notifications non lues de l'utilisateur connecté comme lues.\n\n**Rôles autorisés :** tous les utilisateurs authentifiés.",
  })
  @ApiResponse({ status: 200, description: 'Toutes les notifications sont marquées comme lues.' })
  @ApiResponse({ status: 401, description: 'Non authentifié.' })
  async markAllRead(@CurrentUser() user: JwtPayload) {
    return this.notificationsService.markAllAsRead(user.sub);
  }
}
