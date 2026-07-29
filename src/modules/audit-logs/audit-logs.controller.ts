/**
 * ============================================================================
 * FICHIER : src/modules/audit-logs/audit-logs.controller.ts
 * RÔLE : Contrôleur REST pour la consultation des journaux d'audit immuables.
 * EXPLICATION :
 * Ce contrôleur expose les points d'entrée de recherche et de consultation de la piste d'audit (`/api/v1/audit-logs`) :
 * 1. Accès strictement réservé aux rôles `ADMINISTRATOR` et `SUPERVISOR`.
 * 2. `search` : Recherche paginée filtrable par utilisateur, type d'action, type d'entité et plage de dates.
 * 3. `findOne` : Consultation détaillée d'un événement d'audit spécifique (instantané JSON avant/après).
 * 4. Les entrées d'audit sont **stricte immuables** (aucune suppression ou modification n'est techniquement autorisée).
 * ============================================================================
 */

import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { AuditLogsService } from './audit-logs.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

/**
 * Contrôleur REST sécurisé assurant la traçabilité des opérations sensibles de la plateforme.
 */
@ApiTags('audit-logs')
@ApiBearerAuth()
@Controller('audit-logs')
@UseGuards(RolesGuard)
@Roles('ADMINISTRATOR', 'SUPERVISOR')
export class AuditLogsController {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  /**
   * Endpoint de recherche paginée dans la piste d'audit.
   */
  @Get()
  @ApiOperation({
    summary: "Consulter les journaux d'audit",
    description:
      "Accès en lecture seule aux entrées d'audit. Les journaux sont **immutables**.\n\n**Rôles autorisés :** ADMINISTRATOR, SUPERVISOR",
  })
  @ApiQuery({ name: 'userId', required: false, description: "UUID de l'utilisateur" })
  @ApiQuery({
    name: 'action',
    required: false,
    enum: [
      'TICKET_CREATED',
      'TICKET_ASSIGNED',
      'STATUS_CHANGED',
      'TICKET_CLOSED',
      'TICKET_REOPENED',
      'USER_LOGIN',
      'USER_LOGOUT',
    ],
    description: "Type d'action",
  })
  @ApiQuery({
    name: 'entityType',
    required: false,
    enum: ['ticket', 'user', 'department', 'sla_policy'],
    description: "Type d'entité",
  })
  @ApiQuery({ name: 'from', required: false, example: '2026-01-01', description: 'Date de début (ISO 8601)' })
  @ApiQuery({ name: 'to', required: false, example: '2026-12-31', description: 'Date de fin (ISO 8601)' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 50 })
  @ApiResponse({ status: 200, description: "Liste paginée des entrées d'audit." })
  async search(
    @Query()
    filters: {
      userId?: string;
      action?: string;
      entityType?: string;
      from?: string;
      to?: string;
      page?: number;
      limit?: number;
    },
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.auditLogsService.search(filters, currentUser);
  }

  /**
   * Endpoint de consultation des détails d'une entrée d'audit par son identifiant unique UUID.
   */
  @Get(':id')
  @ApiOperation({ summary: "Détail d'un événement d'audit" })
  @ApiParam({ name: 'id', description: "UUID de l'entrée d'audit" })
  @ApiResponse({ status: 200, description: "Entrée d'audit trouvée." })
  @ApiResponse({ status: 404, description: "Entrée d'audit introuvable." })
  async findOne(@Param('id') id: string, @CurrentUser() currentUser: JwtPayload) {
    return this.auditLogsService.findOne(id, currentUser);
  }
}
