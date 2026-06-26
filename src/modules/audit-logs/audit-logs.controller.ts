import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
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
  @ApiOperation({ summary: "Consulter les journaux d'audit (Admin, Supervisor)" })
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
  @ApiOperation({ summary: "Détail d'un événement d'audit" })
  async findOne(@Param('id') id: string) {
    return this.auditLogsService.findOne(id);
  }
}
