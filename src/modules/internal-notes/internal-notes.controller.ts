import { Controller, Get, Post, Patch, Delete, Body, Param, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { InternalNotesService } from './internal-notes.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { PaginationDto } from '../../common/dto/pagination.dto';

@ApiTags('internal-notes')
@ApiBearerAuth()
@Controller()
export class InternalNotesController {
  constructor(private readonly notesService: InternalNotesService) {}

  @Get('tickets/:ticketId/internal-notes')
  async findAll(@Param('ticketId') ticketId: string, @Query() p: PaginationDto) {
    return this.notesService.findAll(ticketId, p.page, p.limit);
  }

  @Post('tickets/:ticketId/internal-notes')
  @HttpCode(HttpStatus.CREATED)
  async create(@Param('ticketId') ticketId: string, @Body('content') content: string, @CurrentUser() user: JwtPayload) {
    return this.notesService.create(ticketId, user.sub, content, user.role);
  }

  @Patch('internal-notes/:id')
  async update(@Param('id') id: string, @Body('content') content: string, @CurrentUser() user: JwtPayload) {
    return this.notesService.update(id, user.sub, user.role, content);
  }

  @Delete('internal-notes/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    await this.notesService.remove(id, user.sub, user.role);
  }
}
