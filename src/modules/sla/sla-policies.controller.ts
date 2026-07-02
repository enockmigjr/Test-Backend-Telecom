import { Controller, Get, Post, Patch, Body, Param, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam, ApiResponse, ApiBody } from '@nestjs/swagger';
import { SlaPoliciesService } from './sla-policies.service';
import { CreateSlaPolicyDto, UpdateSlaPolicyDto } from './dto/sla-policy.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';

@ApiTags('sla')
@ApiBearerAuth()
@Controller('sla-policies')
@UseGuards(RolesGuard)
export class SlaPoliciesController {
  constructor(private readonly slaPoliciesService: SlaPoliciesService) {}

  @Get()
  @ApiOperation({
    summary: 'Liste des politiques SLA',
    description:
      'Retourne les 24 politiques SLA (6 catégories x 4 priorités).\n\n**Rôles autorisés :** Tous les rôles authentifiés',
  })
  @ApiResponse({
    status: 200,
    description: 'Liste des politiques SLA triées par catégorie puis priorité.',
  })
  @ApiResponse({ status: 401, description: 'Token JWT manquant ou expiré.' })
  @ApiResponse({ status: 429, description: 'Limite de requêtes dépassée.' })
  async findAll() {
    return this.slaPoliciesService.findAll();
  }

  @Get(':id')
  @ApiOperation({
    summary: "Détails d'une politique SLA",
    description:
      'Retourne une politique SLA par son UUID avec ses délais (firstResponseMinutes, resolutionMinutes).\n\n**Rôles autorisés :** Tous les rôles authentifiés',
  })
  @ApiParam({ name: 'id', description: 'UUID de la politique SLA', example: '01922b3c-...' })
  @ApiResponse({ status: 200, description: 'Politique SLA trouvée.' })
  @ApiResponse({ status: 401, description: 'Token JWT manquant ou expiré.' })
  @ApiResponse({ status: 404, description: 'Politique SLA introuvable.' })
  @ApiResponse({ status: 429, description: 'Limite de requêtes dépassée.' })
  async findOne(@Param('id') id: string) {
    return this.slaPoliciesService.findOne(id);
  }

  @Post()
  @Roles('ADMINISTRATOR')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Créer une politique SLA (Admin)',
    description:
      'Crée une politique SLA pour une combinaison catégorie+priorité unique.\n\nLes délais sont en **minutes** :\n- firstResponseMinutes : délai avant première réponse\n- resolutionMinutes : délai avant résolution\n\n**Contrainte UNIQUE** : une seule politique par catégorie/priorité.\n\n**Rôles autorisés :** ADMINISTRATOR uniquement',
  })
  @ApiBody({ type: CreateSlaPolicyDto })
  @ApiResponse({ status: 201, description: 'Politique SLA créée.' })
  @ApiResponse({ status: 400, description: 'Données invalides.' })
  @ApiResponse({ status: 401, description: 'Token JWT manquant ou expiré.' })
  @ApiResponse({ status: 403, description: 'Rôle insuffisant -- ADMINISTRATOR requis.' })
  @ApiResponse({ status: 409, description: 'Une politique existe déjà pour cette catégorie/priorité.' })
  @ApiResponse({ status: 429, description: 'Limite de requêtes dépassée.' })
  async create(@Body() dto: CreateSlaPolicyDto) {
    return this.slaPoliciesService.create(dto);
  }

  @Patch(':id')
  @Roles('ADMINISTRATOR')
  @ApiOperation({
    summary: 'Modifier les délais SLA (Admin)',
    description:
      'Met à jour firstResponseMinutes et/ou resolutionMinutes. La catégorie et priorité ne peuvent pas être modifiées.\n\n**Rôles autorisés :** ADMINISTRATOR uniquement',
  })
  @ApiParam({ name: 'id', description: 'UUID de la politique SLA à modifier' })
  @ApiBody({ type: UpdateSlaPolicyDto })
  @ApiResponse({ status: 200, description: 'Politique SLA mise à jour.' })
  @ApiResponse({ status: 400, description: 'Aucun champ à modifier ou données invalides.' })
  @ApiResponse({ status: 401, description: 'Token JWT manquant ou expiré.' })
  @ApiResponse({ status: 403, description: 'Rôle insuffisant -- ADMINISTRATOR requis.' })
  @ApiResponse({ status: 404, description: 'Politique SLA introuvable.' })
  @ApiResponse({ status: 429, description: 'Limite de requêtes dépassée.' })
  async update(@Param('id') id: string, @Body() dto: UpdateSlaPolicyDto) {
    return this.slaPoliciesService.update(id, dto);
  }
}
