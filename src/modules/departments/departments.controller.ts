import { Controller, Get, Post, Patch, Delete, Body, Param, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

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
  @ApiOperation({ summary: 'Liste des départements disponibles (public)' })
  @ApiResponse({ status: 200, description: 'Liste des départements.' })
  async findAll() {
    return this.departmentsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: "Détails d'un département" })
  @ApiResponse({ status: 200, description: 'Département trouvé.' })
  @ApiResponse({ status: 404, description: 'Département non trouvé.' })
  async findOne(@Param('id') id: string) {
    return this.departmentsService.findOne(id);
  }

  @Post()
  @Roles('ADMINISTRATOR')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Créer un département (Admin uniquement)' })
  @ApiResponse({ status: 201, description: 'Département créé.' })
  @ApiResponse({ status: 409, description: 'Un département avec ce nom existe déjà.' })
  async create(@Body() dto: CreateDepartmentDto) {
    return this.departmentsService.create(dto);
  }

  @Patch(':id')
  @Roles('ADMINISTRATOR')
  @ApiOperation({ summary: 'Modifier un département (Admin uniquement)' })
  async update(@Param('id') id: string, @Body() dto: UpdateDepartmentDto) {
    return this.departmentsService.update(id, dto);
  }

  @Delete(':id')
  @Roles('ADMINISTRATOR')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Supprimer un département (Admin uniquement, soft delete)' })
  @ApiResponse({ status: 204, description: 'Département supprimé.' })
  @ApiResponse({ status: 409, description: 'Des utilisateurs ou tickets sont liés.' })
  async remove(@Param('id') id: string) {
    await this.departmentsService.remove(id);
  }
}
