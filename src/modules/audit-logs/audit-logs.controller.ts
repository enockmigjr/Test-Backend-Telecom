import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { AuditLogsService } from './audit-logs.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';

@ApiTags('audit-logs')
@ApiBearerAuth()
@Controller('audit-logs')
@UseGuards(RolesGuard)
@Roles('ADMINISTRATOR', 'SUPERVISOR')
export class AuditLogsController {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  @Get()
  @ApiOperation({
    summary: "Consulter les journaux d'audit",
    description:
      "Acc\u00e8s en lecture seule aux entr\u00e9es d'audit. Les journaux sont **immutables**.\n\n**R\u00f4les autoris\u00e9s :** ADMINISTRATOR, SUPERVISOR",
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
    description: "Type d'entite",
  })
  @ApiQuery({ name: 'from', required: false, example: '2026-01-01', description: 'Date de debut (ISO 8601)' })
  @ApiQuery({ name: 'to', required: false, example: '2026-12-31', description: 'Date de fin (ISO 8601)' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 50 })
  @ApiResponse({ status: 200, description: "Liste paginee des entrees d'audit." })
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
  ) {
    return this.auditLogsService.search(filters);
  }

  @Get(':id')
  @ApiOperation({ summary: "Detail d'un evenement d'audit" })
  @ApiParam({ name: 'id', description: "UUID de l'entree d'audit" })
  @ApiResponse({ status: 200, description: "Entree d'audit trouvee." })
  @ApiResponse({ status: 404, description: "Entree d'audit introuvable." })
  async findOne(@Param('id') id: string) {
    return this.auditLogsService.findOne(id);
  }
}
