import { Controller, Get, Post, Patch, Delete, Body, Param, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery, ApiBody } from '@nestjs/swagger';
import { InternalNotesService } from './internal-notes.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { CreateInternalNoteDto } from './dto/create-internal-note.dto';
import { UpdateInternalNoteDto } from './dto/update-internal-note.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';

@ApiTags('internal-notes')
@ApiBearerAuth()
@Controller()
export class InternalNotesController {
  constructor(private readonly notesService: InternalNotesService) {}

  @Get('tickets/:ticketId/internal-notes')
  @ApiOperation({
    summary: "Notes internes d'un ticket",
    description:
      "Retourne la liste paginée des notes internes d'un ticket. Les FIELD_TECHNICIAN n'ont pas accès aux notes internes.\n\n**Rôles autorisés :** tous sauf FIELD_TECHNICIAN",
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
  @ApiResponse({ status: 200, description: 'Liste paginée des notes internes avec le nom de chaque auteur.' })
  @ApiResponse({ status: 401, description: 'Token JWT manquant ou expiré.' })
  @ApiResponse({ status: 403, description: 'Accès refusé — FIELD_TECHNICIAN non autorisé.' })
  @ApiResponse({ status: 404, description: 'Ticket non trouvé.' })
  async findAll(@Param('ticketId') ticketId: string, @Query() p: PaginationDto) {
    return this.notesService.findAll(ticketId, p.page, p.limit);
  }

  @Post('tickets/:ticketId/internal-notes')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Ajouter une note interne',
    description:
      'Crée une note interne sur un ticket. Les FIELD_TECHNICIAN ne peuvent pas créer de notes internes.\n\n**Rôles autorisés :** tous sauf FIELD_TECHNICIAN',
  })
  @ApiParam({ name: 'ticketId', description: 'UUID du ticket concerné' })
  @ApiBody({
    type: CreateInternalNoteDto,
    examples: { default: { value: { content: 'Diagnostic NOC : problème identifié sur le lien fibre principal.' } } },
  })
  @ApiResponse({ status: 201, description: 'Note interne créée avec succès.' })
  @ApiResponse({ status: 400, description: 'Contenu vide ou invalide.' })
  @ApiResponse({ status: 401, description: 'Non authentifié.' })
  @ApiResponse({ status: 403, description: 'Accès refusé — FIELD_TECHNICIAN non autorisé.' })
  @ApiResponse({ status: 404, description: 'Ticket non trouvé.' })
  async create(
    @Param('ticketId') ticketId: string,
    @Body() dto: CreateInternalNoteDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.notesService.create(ticketId, user.sub, dto.content, user.role);
  }

  @Patch('internal-notes/:id')
  @ApiOperation({
    summary: 'Modifier une note interne',
    description:
      "Modifie le contenu d'une note interne. Seul l'auteur ou un ADMINISTRATOR/SUPERVISOR peut la modifier. Les FIELD_TECHNICIAN ne sont pas autorisés.\n\n**Rôles autorisés :** auteur de la note, ADMINISTRATOR, SUPERVISOR",
  })
  @ApiParam({ name: 'id', description: 'UUID de la note interne' })
  @ApiBody({ type: UpdateInternalNoteDto })
  @ApiResponse({ status: 200, description: 'Note interne mise à jour.' })
  @ApiResponse({ status: 400, description: 'Contenu vide ou invalide.' })
  @ApiResponse({ status: 401, description: 'Non authentifié.' })
  @ApiResponse({ status: 403, description: 'Accès refusé.' })
  @ApiResponse({ status: 404, description: 'Note interne non trouvée.' })
  async update(@Param('id') id: string, @Body() dto: UpdateInternalNoteDto, @CurrentUser() user: JwtPayload) {
    return this.notesService.update(id, user.sub, user.role, dto.content);
  }

  @Delete('internal-notes/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Supprimer une note interne',
    description:
      "Supprime une note interne. Seul l'auteur ou un ADMINISTRATOR/SUPERVISOR peut la supprimer.\n\n**Rôles autorisés :** auteur de la note, ADMINISTRATOR, SUPERVISOR",
  })
  @ApiParam({ name: 'id', description: 'UUID de la note interne à supprimer' })
  @ApiResponse({ status: 204, description: 'Note interne supprimée.' })
  @ApiResponse({ status: 401, description: 'Non authentifié.' })
  @ApiResponse({ status: 403, description: 'Accès refusé.' })
  @ApiResponse({ status: 404, description: 'Note interne non trouvée.' })
  async remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    await this.notesService.remove(id, user.sub, user.role);
  }
}
