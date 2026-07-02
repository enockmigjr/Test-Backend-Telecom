import { Controller, Get, Post, Patch, Delete, Body, Param, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiBody } from '@nestjs/swagger';

import { DepartmentsService } from './departments.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('departments')
@ApiBearerAuth()
@Controller('departments')
@UseGuards(RolesGuard)
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @Public()
  @Get()
  @ApiOperation({
    summary: 'Liste des départements disponibles (public)',
    description:
      'Retourne la liste de tous les départements.\n\nCet endpoint est public (aucune authentification requise).',
  })
  @ApiResponse({ status: 200, description: 'Liste des départements.' })
  @ApiResponse({ status: 429, description: 'Limite de requêtes dépassée.' })
  async findAll() {
    return this.departmentsService.findAll();
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Détails d\'un département',
    description:
      'Retourne un département par son UUID.\n\n**Rôles autorisés :** Tous les rôles authentifiés',
  })
  @ApiParam({ name: 'id', description: 'UUID du département', example: '01922b3c-...' })
  @ApiResponse({ status: 200, description: 'Département trouvé.' })
  @ApiResponse({ status: 401, description: 'Token JWT manquant ou expiré.' })
  @ApiResponse({ status: 404, description: 'Département non trouvé.' })
  @ApiResponse({ status: 429, description: 'Limite de requêtes dépassée.' })
  async findOne(@Param('id') id: string) {
    return this.departmentsService.findOne(id);
  }

  @Post()
  @Roles('ADMINISTRATOR')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Créer un département (Admin uniquement)',
    description:
      'Crée un nouveau département.\n\nLe nom doit être unique.\n\n**Rôles autorisés :** ADMINISTRATOR uniquement',
  })
  @ApiBody({ type: CreateDepartmentDto })
  @ApiResponse({ status: 201, description: 'Département créé.' })
  @ApiResponse({ status: 400, description: 'Données invalides.' })
  @ApiResponse({ status: 401, description: 'Token JWT manquant ou expiré.' })
  @ApiResponse({ status: 403, description: 'Rôle insuffisant -- ADMINISTRATOR requis.' })
  @ApiResponse({ status: 409, description: 'Un département avec ce nom existe déjà.' })
  @ApiResponse({ status: 429, description: 'Limite de requêtes dépassée.' })
  async create(@Body() dto: CreateDepartmentDto) {
    return this.departmentsService.create(dto);
  }

  @Patch(':id')
  @Roles('ADMINISTRATOR')
  @ApiOperation({
    summary: 'Modifier un département (Admin uniquement)',
    description:
      'Met à jour le nom et/ou la description d\'un département.\n\n**Rôles autorisés :** ADMINISTRATOR uniquement',
  })
  @ApiParam({ name: 'id', description: 'UUID du département' })
  @ApiBody({ type: UpdateDepartmentDto })
  @ApiResponse({ status: 200, description: 'Département mis à jour.' })
  @ApiResponse({ status: 400, description: 'Aucun champ à modifier ou nom déjà utilisé.' })
  @ApiResponse({ status: 401, description: 'Token JWT manquant ou expiré.' })
  @ApiResponse({ status: 403, description: 'Rôle insuffisant -- ADMINISTRATOR requis.' })
  @ApiResponse({ status: 404, description: 'Département non trouvé.' })
  @ApiResponse({ status: 409, description: 'Un département avec ce nom existe déjà.' })
  @ApiResponse({ status: 429, description: 'Limite de requêtes dépassée.' })
  async update(@Param('id') id: string, @Body() dto: UpdateDepartmentDto) {
    return this.departmentsService.update(id, dto);
  }

  @Delete(':id')
  @Roles('ADMINISTRATOR')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Supprimer un département (Admin uniquement, soft delete)',
    description:
      'Supprime un département (soft delete) si aucun utilisateur ou ticket n\'y est lié.\n\n**Rôles autorisés :** ADMINISTRATOR uniquement',
  })
  @ApiParam({ name: 'id', description: 'UUID du département' })
  @ApiResponse({ status: 204, description: 'Département supprimé.' })
  @ApiResponse({ status: 401, description: 'Token JWT manquant ou expiré.' })
  @ApiResponse({ status: 403, description: 'Rôle insuffisant -- ADMINISTRATOR requis.' })
  @ApiResponse({ status: 404, description: 'Département non trouvé.' })
  @ApiResponse({ status: 409, description: 'Des utilisateurs ou tickets sont liés à ce département.' })
  @ApiResponse({ status: 429, description: 'Limite de requêtes dépassée.' })
  async remove(@Param('id') id: string) {
    await this.departmentsService.remove(id);
  }
}
