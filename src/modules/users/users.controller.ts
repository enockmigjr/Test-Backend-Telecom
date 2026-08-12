/**
 * ============================================================================
 * FICHIER : src/modules/users/users.controller.ts
 * RÔLE : Contrôleur REST pour la gestion des utilisateurs (`/api/v1/users`).
 * EXPLICATION :
 * Ce contrôleur gère la création des comptes employés, leur modification,
 * leur désactivation ou leur réactivation, ainsi que la recherche et la consultation
 * des détails des agents et techniciens. Seuls les administrateurs et superviseurs
 * y ont accès selon la matrice de droits (RBAC).
 * ============================================================================
 */

import { Controller, Get, Post, Patch, Body, Param, Query, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery, ApiBody } from '@nestjs/swagger';

import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { SetAbsenceDto } from './dto/set-absence.dto';
import { SetAvailabilityDto } from './dto/set-availability.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

/**
 * Class UsersController
 */
@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
@UseGuards(RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /** Route de liste paginée de tous les utilisateurs */
  @Get()
  @Roles('ADMINISTRATOR', 'SUPERVISOR')
  @ApiOperation({
    summary: 'Liste paginée des utilisateurs',
    description:
      'Retourne la liste paginée de tous les utilisateurs actifs avec leur département.\n\n**Rôles autorisés :** ADMINISTRATOR, SUPERVISOR',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1, description: 'Page courante' })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20, description: 'Éléments par page (max 100)' })
  @ApiQuery({
    name: 'order',
    required: false,
    enum: ['asc', 'desc'],
    example: 'desc',
    description: 'Ordre de tri par date de création',
  })
  @ApiResponse({ status: 200, description: 'Liste paginée des utilisateurs avec leur département.' })
  @ApiResponse({ status: 401, description: 'Token JWT manquant ou expiré.' })
  @ApiResponse({ status: 403, description: 'Rôle insuffisant — ADMINISTRATOR ou SUPERVISOR requis.' })
  async findAll(@Query() pagination: PaginationDto, @CurrentUser() currentUser: JwtPayload) {
    return this.usersService.findAll(pagination, currentUser);
  }

  /** Route d'accès à son propre profil */
  @Get('me')
  @ApiOperation({
    summary: "Profil de l'utilisateur connecté",
    description: "Retourne le profil complet de l'utilisateur authentifié, incluant son département.",
  })
  @ApiResponse({
    status: 200,
    description: 'Profil utilisateur avec département.',
  })
  @ApiResponse({ status: 401, description: 'Non authentifié.' })
  async me(@CurrentUser() user: JwtPayload) {
    return this.usersService.findOne(user.sub);
  }

  /** Route de mise en pause / reprise volontaire (self-service, tout rôle authentifié) */
  @Patch('me/availability')
  @ApiOperation({
    summary: 'Mettre en pause / reprendre (self-service)',
    description:
      "Permet à un agent de se mettre en pause ou de reprendre. L'agent en pause est exclu de l'auto-assignation.",
  })
  @ApiBody({ type: SetAvailabilityDto })
  @ApiResponse({ status: 200, description: 'Disponibilité mise à jour.' })
  async setAvailability(@Body() dto: SetAvailabilityDto, @CurrentUser() user: JwtPayload) {
    return this.usersService.setAvailability(user.sub, dto.available);
  }

  /** Route de déclaration d'absence (courte auto, prolongée admin/superviseur) */
  @Patch('me/absence')
  @ApiOperation({
    summary: 'Déclarer / annuler son absence',
    description:
      "L'absence courte (<= 7 jours) est libre ; l'absence prolongée doit être déclarée par un ADMINISTRATOR ou SUPERVISOR.",
  })
  @ApiBody({ type: SetAbsenceDto })
  @ApiResponse({ status: 200, description: 'Absence enregistrée.' })
  @ApiResponse({ status: 403, description: 'Absence prolongée non autorisée pour ce rôle.' })
  async setAbsence(@Body() dto: SetAbsenceDto, @CurrentUser() user: JwtPayload) {
    return this.usersService.setOwnAbsence(user.sub, dto.absenceEndsAt, user);
  }

  /** Route de consultation des détails d'un utilisateur par son ID */
  @Get(':id')
  @Roles('ADMINISTRATOR', 'SUPERVISOR')
  @ApiOperation({
    summary: "Détails d'un utilisateur",
    description:
      "Retourne le profil d'un utilisateur.\n\nAvec `?detail=full`, enrichit la réponse avec les statistiques des tickets (total créés/assignés, tickets ouverts, résolutions, violations SLA) et les 5 derniers tickets assignés.\n\n**Rôles autorisés :** ADMINISTRATOR, SUPERVISOR",
  })
  @ApiParam({ name: 'id', description: "UUID de l'utilisateur", example: '01922b3c-...' })
  @ApiQuery({
    name: 'detail',
    required: false,
    enum: ['full', 'summary'],
    example: 'full',
    description: 'full = profil + stats tickets | summary = profil seul',
  })
  @ApiResponse({
    status: 200,
    description: 'Profil utilisateur avec département et optionnellement les statistiques tickets.',
  })
  @ApiResponse({ status: 401, description: 'Non authentifié.' })
  @ApiResponse({ status: 403, description: 'Rôle insuffisant.' })
  @ApiResponse({ status: 404, description: 'Utilisateur non trouvé.' })
  async findOne(@Param('id') id: string, @Query('detail') detail?: string) {
    if (detail === 'full') {
      return this.usersService.findOneDetailed(id);
    }
    return this.usersService.findOne(id);
  }

  /** Route de création d'un nouveau compte utilisateur (ADMIN uniquement) */
  @Post()
  @Roles('ADMINISTRATOR')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Créer un utilisateur',
    description:
      "Crée un nouveau compte utilisateur avec un mot de passe temporaire généré automatiquement.\n\nLe champ `tempPassword` est retourné **une seule fois** dans la réponse — à envoyer à l'utilisateur par email.\n\n**Rôles autorisés :** ADMINISTRATOR uniquement",
  })
  @ApiBody({ type: CreateUserDto })
  @ApiResponse({
    status: 201,
    description: 'Utilisateur créé avec mot de passe temporaire.',
    schema: {
      example: {
        message: 'Utilisateur créé avec succès.',
        data: {
          id: '01922b3c-d4e5-7f8a-...',
          email: 'agent@telecom.local',
          firstName: 'Jean',
          lastName: 'Dupont',
          role: 'CUSTOMER_SERVICE_AGENT',
          departmentId: '...',
          departmentName: 'Customer Care',
          mustChangePassword: true,
          tempPassword: 'a1b2c3d4e5f6...',
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Données invalides (département introuvable, format email incorrect…).' })
  @ApiResponse({ status: 401, description: 'Non authentifié.' })
  @ApiResponse({ status: 403, description: 'Rôle insuffisant — ADMINISTRATOR requis.' })
  @ApiResponse({ status: 409, description: 'Un utilisateur avec cet email existe déjà.' })
  async create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  /** Route de mise à jour partielle des informations d'un utilisateur */
  @Patch(':id')
  @Roles('ADMINISTRATOR', 'SUPERVISOR')
  @ApiOperation({
    summary: 'Modifier un utilisateur',
    description:
      "Met à jour les informations d'un utilisateur (nom, rôle, département).\n\n**Rôles autorisés :** ADMINISTRATOR, SUPERVISOR",
  })
  @ApiParam({ name: 'id', description: "UUID de l'utilisateur" })
  @ApiBody({ type: UpdateUserDto })
  @ApiResponse({ status: 200, description: 'Utilisateur mis à jour avec succès.' })
  @ApiResponse({ status: 400, description: 'Aucun champ à modifier ou données invalides.' })
  @ApiResponse({ status: 401, description: 'Non authentifié.' })
  @ApiResponse({ status: 403, description: 'Rôle insuffisant.' })
  @ApiResponse({ status: 404, description: 'Utilisateur non trouvé.' })
  async update(@Param('id') id: string, @Body() dto: UpdateUserDto, @CurrentUser() currentUser: JwtPayload) {
    return this.usersService.update(id, dto, currentUser);
  }

  /** Route de désactivation du compte d'un utilisateur */
  @Patch(':id/deactivate')
  @Roles('ADMINISTRATOR')
  @ApiOperation({
    summary: 'Désactiver un compte',
    description:
      "Désactive le compte d'un utilisateur. L'utilisateur ne pourra plus se connecter.\n\n**Rôles autorisés :** ADMINISTRATOR uniquement",
  })
  @ApiParam({ name: 'id', description: "UUID de l'utilisateur à désactiver" })
  @ApiResponse({ status: 200, description: 'Compte désactivé avec succès.' })
  @ApiResponse({ status: 400, description: 'Le compte est déjà désactivé.' })
  @ApiResponse({ status: 401, description: 'Non authentifié.' })
  @ApiResponse({ status: 403, description: 'Rôle insuffisant — ADMINISTRATOR requis.' })
  @ApiResponse({ status: 404, description: 'Utilisateur non trouvé.' })
  async deactivate(@Param('id') id: string) {
    return this.usersService.deactivate(id);
  }

  /** Route de réactivation d'un compte utilisateur */
  @Patch(':id/activate')
  @Roles('ADMINISTRATOR')
  @ApiOperation({
    summary: 'Réactiver un compte',
    description:
      'Réactive un compte utilisateur précédemment désactivé.\n\n**Rôles autorisés :** ADMINISTRATOR uniquement',
  })
  @ApiParam({ name: 'id', description: "UUID de l'utilisateur à réactiver" })
  @ApiResponse({ status: 200, description: 'Compte réactivé avec succès.' })
  @ApiResponse({ status: 400, description: 'Le compte est déjà actif.' })
  @ApiResponse({ status: 401, description: 'Non authentifié.' })
  @ApiResponse({ status: 403, description: 'Rôle insuffisant — ADMINISTRATOR requis.' })
  @ApiResponse({ status: 404, description: 'Utilisateur non trouvé.' })
  async activate(@Param('id') id: string) {
    return this.usersService.activate(id);
  }
}
