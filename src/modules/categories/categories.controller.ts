/**
 * ============================================================================
 * FICHIER : src/modules/categories/categories.controller.ts
 * RÔLE : Contrôleur REST de gestion de la typologie et des catégories d'incidents.
 * EXPLICATION :
 * Ce contrôleur expose les points d'entrée (GET, POST, PATCH, DELETE) sur `/api/v1/categories` :
 * 1. Consultation (`GET /`, `GET /:id`) : Accessible à tous les agents authentifiés pour alimenter les listes déroulantes de création de tickets.
 * 2. Administration (`POST`, `PATCH`, `DELETE`) : Strictement réservé au rôle `ADMINISTRATOR` (`@Roles('ADMINISTRATOR')`).
 * 3. Intégrité référentielle : La suppression échoue (HTTP 409) si la catégorie est associée à des tickets actifs ou à des politiques SLA.
 * ============================================================================
 */

import { Controller, Get, Post, Patch, Delete, Body, Param, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiBody } from '@nestjs/swagger';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/create-category.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';

/**
 * Contrôleur d'API pour le référentiel des catégories d'incidents télécom.
 */
@ApiTags('categories')
@ApiBearerAuth()
@Controller('categories')
@UseGuards(RolesGuard)
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  /**
   * Extrait la liste complète des catégories de tickets disponibles dans le système.
   */
  @Get()
  @ApiOperation({
    summary: 'Liste de toutes les catégories',
    description:
      'Retourne la liste complète de toutes les catégories de tickets disponibles.\n\n**Rôles autorisés :** Tous les utilisateurs authentifiés.',
  })
  @ApiResponse({ status: 200, description: 'Liste des catégories.' })
  @ApiResponse({ status: 401, description: 'Token JWT manquant ou expiré.' })
  async findAll() {
    return this.categoriesService.findAll();
  }

  /**
   * Recherche et retourne le détail d'une catégorie d'incident par son identifiant UUIDv7.
   *
   * @param id Identifiant unique UUID de la catégorie.
   */
  @Get(':id')
  @ApiOperation({
    summary: "Détails d'une catégorie",
    description:
      "Retourne les informations d'une catégorie par son UUID.\n\n**Rôles autorisés :** Tous les utilisateurs authentifiés.",
  })
  @ApiParam({ name: 'id', description: 'UUID de la catégorie', example: '550e8400-e29b-41d4-a716-446655440000' })
  @ApiResponse({ status: 200, description: 'Catégorie trouvée.' })
  @ApiResponse({ status: 401, description: 'Token JWT manquant ou expiré.' })
  @ApiResponse({ status: 404, description: 'Catégorie non trouvée.' })
  async findOne(@Param('id') id: string) {
    return this.categoriesService.findOne(id);
  }

  /**
   * Enregistre une nouvelle catégorie de ticket avec son rôle cible d'assignation automatique (`targetRole`).
   *
   * @param dto Objet DTO contenant le nom, la description et le rôle cible.
   */
  @Post()
  @Roles('ADMINISTRATOR')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Créer une catégorie (Admin uniquement)',
    description:
      'Crée une nouvelle catégorie de ticket. Le nom doit être unique.\n\n**Rôles autorisés :** ADMINISTRATOR uniquement.',
  })
  @ApiBody({ type: CreateCategoryDto })
  @ApiResponse({ status: 201, description: 'Catégorie créée avec succès.' })
  @ApiResponse({ status: 400, description: 'Données de requête invalides.' })
  @ApiResponse({ status: 401, description: 'Token JWT manquant ou expiré.' })
  @ApiResponse({ status: 403, description: 'Permission refusée -- Administrateur requis.' })
  @ApiResponse({ status: 409, description: 'Une catégorie avec ce nom existe déjà.' })
  async create(@Body() dto: CreateCategoryDto) {
    return this.categoriesService.create(dto);
  }

  /**
   * Met à jour les propriétés d'une catégorie existante (nom, description, targetRole).
   *
   * @param id Identifiant UUID de la catégorie.
   * @param dto Champs modifiés.
   */
  @Patch(':id')
  @Roles('ADMINISTRATOR')
  @ApiOperation({
    summary: 'Modifier une catégorie (Admin uniquement)',
    description: "Met à jour les informations d'une catégorie.\n\n**Rôles autorisés :** ADMINISTRATOR uniquement.",
  })
  @ApiParam({ name: 'id', description: 'UUID de la catégorie' })
  @ApiBody({ type: UpdateCategoryDto })
  @ApiResponse({ status: 200, description: 'Catégorie mise à jour.' })
  @ApiResponse({ status: 400, description: 'Données de requête invalides.' })
  @ApiResponse({ status: 401, description: 'Token JWT manquant ou expiré.' })
  @ApiResponse({ status: 403, description: 'Permission refusée -- Administrateur requis.' })
  @ApiResponse({ status: 404, description: 'Catégorie non trouvée.' })
  @ApiResponse({ status: 409, description: 'Une catégorie avec ce nom existe déjà.' })
  async update(@Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    return this.categoriesService.update(id, dto);
  }

  /**
   * Supprime une catégorie si aucun ticket ni politique SLA ne l'utilise.
   *
   * @param id Identifiant UUID de la catégorie à supprimer.
   */
  @Delete(':id')
  @Roles('ADMINISTRATOR')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Supprimer une catégorie (Admin uniquement)',
    description:
      "Supprime définitivement une catégorie de la base si aucun ticket ni politique SLA n'y est rattaché.\n\n**Rôles autorisés :** ADMINISTRATOR uniquement.",
  })
  @ApiParam({ name: 'id', description: 'UUID de la catégorie' })
  @ApiResponse({ status: 200, description: 'Catégorie supprimée.' })
  @ApiResponse({ status: 401, description: 'Token JWT manquant ou expiré.' })
  @ApiResponse({ status: 403, description: 'Permission refusée -- Administrateur requis.' })
  @ApiResponse({ status: 404, description: 'Catégorie non trouvée.' })
  @ApiResponse({ status: 409, description: 'Impossible de supprimer : des tickets ou politiques SLA sont liés.' })
  async remove(@Param('id') id: string) {
    return this.categoriesService.remove(id);
  }
}
