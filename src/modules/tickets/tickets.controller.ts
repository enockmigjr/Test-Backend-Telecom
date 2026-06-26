import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

import { TicketsService } from './services/tickets.service';
import { TicketsSearchService } from './services/tickets-search.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { SearchTicketsDto } from './dto/search-tickets.dto';
import { AssignTicketDto } from './dto/assign-ticket.dto';
import { EscalateTicketDto } from './dto/escalate-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { RolesGuard } from '../auth/guards/roles.guard';

@ApiTags('tickets')
@ApiBearerAuth()
@Controller('tickets')
@UseGuards(RolesGuard)
export class TicketsController {
  constructor(
    private readonly ticketsService: TicketsService,
    private readonly searchService: TicketsSearchService,
  ) {}

  @Post()
  @Roles(
    'ADMINISTRATOR',
    'SUPERVISOR',
    'CUSTOMER_SERVICE_AGENT',
    'NOC_ENGINEER',
    'BILLING_AGENT',
    'TECHNICAL_SUPPORT_ENGINEER',
    'FIELD_TECHNICIAN',
  )
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Créer un ticket d'incident" })
  @ApiResponse({ status: 201, description: 'Ticket créé.' })
  async create(@Body() dto: CreateTicketDto, @CurrentUser() user: JwtPayload) {
    return this.ticketsService.create(dto, user.sub);
  }

  @Get()
  @ApiOperation({ summary: 'Rechercher des tickets avec filtres' })
  async search(@Query() filters: SearchTicketsDto) {
    return this.searchService.search(filters);
  }

  @Get(':id')
  @ApiOperation({ summary: "Détails complets d'un ticket" })
  @ApiResponse({ status: 404, description: 'Ticket non trouvé.' })
  async findOne(@Param('id') id: string) {
    return this.ticketsService.findById(id);
  }

  @Patch(':id')
  @Roles('ADMINISTRATOR', 'SUPERVISOR')
  @ApiOperation({ summary: 'Mettre à jour un ticket' })
  async update(@Param('id') id: string, @Body() dto: UpdateTicketDto, @CurrentUser() user: JwtPayload) {
    return this.ticketsService.update(id, dto, user.sub);
  }

  @Post(':id/assign')
  @Roles('ADMINISTRATOR', 'SUPERVISOR')
  @ApiOperation({ summary: 'Assigner un ticket à un agent' })
  async assign(@Param('id') id: string, @Body() dto: AssignTicketDto, @CurrentUser() user: JwtPayload) {
    return this.ticketsService.assign(id, dto.userId, user.sub, dto.reason);
  }

  @Post(':id/escalate')
  @Roles('ADMINISTRATOR', 'SUPERVISOR')
  @ApiOperation({ summary: 'Escalader un ticket' })
  async escalate(@Param('id') id: string, @Body() dto: EscalateTicketDto, @CurrentUser() user: JwtPayload) {
    return this.ticketsService.escalate(id, dto.userId, dto.departmentId, user.sub, dto.reason);
  }

  @Post(':id/resolve')
  @Roles(
    'ADMINISTRATOR',
    'SUPERVISOR',
    'CUSTOMER_SERVICE_AGENT',
    'NOC_ENGINEER',
    'BILLING_AGENT',
    'TECHNICAL_SUPPORT_ENGINEER',
    'FIELD_TECHNICIAN',
  )
  @ApiOperation({ summary: 'Marquer un ticket comme résolu' })
  async resolve(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.ticketsService.changeStatus(id, 'RESOLVED', user.sub);
  }

  @Post(':id/close')
  @Roles('ADMINISTRATOR', 'SUPERVISOR')
  @ApiOperation({ summary: 'Clôturer un ticket résolu' })
  async close(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.ticketsService.changeStatus(id, 'CLOSED', user.sub);
  }

  @Post(':id/reopen')
  @Roles('ADMINISTRATOR', 'SUPERVISOR')
  @ApiOperation({ summary: 'Réouvrir un ticket clôturé' })
  async reopen(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.ticketsService.changeStatus(id, 'REOPENED', user.sub);
  }

  @Get(':id/history')
  @ApiOperation({ summary: "Historique complet d'un ticket" })
  async history(@Param('id') id: string) {
    return this.ticketsService.getHistory(id);
  }

  @Delete(':id')
  @Roles('ADMINISTRATOR')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Supprimer un ticket (soft delete, Admin uniquement)' })
  async remove(@Param('id') id: string) {
    await this.ticketsService.softDelete(id);
  }
}
