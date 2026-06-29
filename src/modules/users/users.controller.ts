import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { FieldProjectionInterceptor } from '../../common/interceptors/field-projection.interceptor';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
@UseGuards(RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @UseInterceptors(FieldProjectionInterceptor)
  @Roles('ADMINISTRATOR', 'SUPERVISOR')
  @ApiOperation({ summary: 'Liste des utilisateurs (Admin, Supervisor) — param ?detail=summary|full' })
  async findAll(@Query() pagination: PaginationDto) {
    return this.usersService.findAll(pagination);
  }

  @Get('me')
  @ApiOperation({ summary: "Profil détaillé de l'utilisateur connecté" })
  async me(@CurrentUser() user: JwtPayload) {
    return this.usersService.findOne(user.sub);
  }

  @Get(':id')
  @Roles('ADMINISTRATOR', 'SUPERVISOR')
  @ApiOperation({ summary: "Détails d'un utilisateur (Admin, Supervisor ou soi-même)" })
  @ApiResponse({ status: 404, description: 'Utilisateur non trouvé.' })
  async findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Post()
  @Roles('ADMINISTRATOR')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Créer un utilisateur (Admin uniquement)' })
  @ApiResponse({ status: 201, description: 'Utilisateur créé.' })
  @ApiResponse({ status: 409, description: 'Email déjà utilisé.' })
  async create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Patch(':id')
  @Roles('ADMINISTRATOR', 'SUPERVISOR')
  @ApiOperation({ summary: 'Modifier un utilisateur (Admin, Supervisor)' })
  async update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  @Patch(':id/deactivate')
  @Roles('ADMINISTRATOR')
  @ApiOperation({ summary: 'Désactiver un compte utilisateur (Admin uniquement)' })
  async deactivate(@Param('id') id: string) {
    return this.usersService.deactivate(id);
  }

  @Patch(':id/activate')
  @Roles('ADMINISTRATOR')
  @ApiOperation({ summary: 'Réactiver un compte utilisateur (Admin uniquement)' })
  async activate(@Param('id') id: string) {
    return this.usersService.activate(id);
  }
}
