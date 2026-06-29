import { Controller, Post, Get, Param, Query, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { DateRangeDto } from '../../common/dto/date-range.dto';

@ApiTags('reports')
@ApiBearerAuth()
@Controller('reports')
@UseGuards(RolesGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post('ticket/:id')
  @Roles('ADMINISTRATOR', 'SUPERVISOR')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Générer un rapport détaillé pour un ticket' })
  async ticketReport(@Param('id') id: string) {
    return this.reportsService.ticketReport(id);
  }

  @Get('sla')
  @Roles('ADMINISTRATOR', 'SUPERVISOR')
  @ApiOperation({ summary: 'Rapport SLA sur une période' })
  async slaReport(@Query() range: DateRangeDto) {
    return this.reportsService.slaReport(range.from, range.to);
  }
}
