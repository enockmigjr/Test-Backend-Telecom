/**
 * ============================================================================
 * FICHIER : src/modules/sla/sla-policies.controller.ts
 * RÔLE : Contrôleur REST de gestion des politiques contractuelles de service SLA (`/api/v1/sla-policies`).
 * EXPLICATION :
 * Ce contrôleur permet la consultation et la configuration des engagements de service :
 * 1. Consultation (`GET /`, `GET /:id`) : Permet à tous les agents de consulter les délais cibles de réponse et de résolution par catégorie/priorité.
 * 2. Création et Édition (`POST`, `PATCH`) : Réservé aux administrateurs (`@Roles('ADMINISTRATOR')`). Garantit l'unicité du couple (catégorie, priorité).
 * ============================================================================
 */

import { Controller, Get, Post, Patch, Body, Param, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam, ApiResponse, ApiBody } from '@nestjs/swagger';
import { SlaPoliciesService } from './sla-policies.service';
import { CreateSlaPolicyDto, UpdateSlaPolicyDto } from './dto/sla-policy.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';

/**
 * Contrôleur d'API pour l'administration des règles contractuelles SLA.
 */
@ApiTags('sla')
@ApiBearerAuth()
@Controller('sla-policies')
@UseGuards(RolesGuard)
export class SlaPoliciesController {
  constructor(private readonly slaPoliciesService: SlaPoliciesService) {}

  /**
   * Extrait la liste complète des politiques SLA définies sur la plateforme.
   */
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

  /**
   * Recherche le détail d'une politique SLA par son identifiant UUIDv7.
   *
   * @param id UUID de la politique.
   */
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

  /**
   * Enregistre une nouvelle règle de contrat SLA pour un couple catégorie/priorité.
   *
   * @param dto Paramètres de la politique SLA (délais en minutes, mode 24_7 ou BUSINESS_HOURS).
   */
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

  /**
   * Modifie les délais cibles d'une politique SLA existante.
   *
   * @param id UUID de la politique SLA.
   * @param dto Nouveaux délais de réponse et résolution.
   */
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
