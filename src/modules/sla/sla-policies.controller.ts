import { Controller, Get, Post, Patch, Body, Param, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SlaPoliciesService } from './sla-policies.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';

@ApiTags('sla')
@ApiBearerAuth()
@Controller('sla-policies')
@UseGuards(RolesGuard)
export class SlaPoliciesController {
  constructor(private readonly slaPoliciesService: SlaPoliciesService) {}

  @Get()
  @ApiOperation({ summary: 'Liste des politiques SLA' })
  async findAll() {
    return this.slaPoliciesService.findAll();
  }

  @Post()
  @Roles('ADMINISTRATOR')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Créer une politique SLA (Admin)' })
  async create(
    @Body() dto: { category: string; priority: string; firstResponseMinutes: number; resolutionMinutes: number },
  ) {
    return this.slaPoliciesService.create(dto);
  }

  @Patch(':id')
  @Roles('ADMINISTRATOR')
  @ApiOperation({ summary: 'Modifier une politique SLA (Admin)' })
  async update(@Param('id') id: string, @Body() dto: { firstResponseMinutes?: number; resolutionMinutes?: number }) {
    return this.slaPoliciesService.update(id, dto);
  }
}
