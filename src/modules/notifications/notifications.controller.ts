import { Controller, Get, Patch, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { PaginationDto } from '../../common/dto/pagination.dto';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

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
