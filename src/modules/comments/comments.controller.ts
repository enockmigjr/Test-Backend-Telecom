import { Controller, Get, Post, Patch, Delete, Body, Param, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CommentsService } from './comments.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';

@ApiTags('comments')
@ApiBearerAuth()
@Controller()
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Get('tickets/:ticketId/comments')
  @ApiOperation({ summary: "Commentaires publics d'un ticket" })
  async findAll(@Param('ticketId') ticketId: string, @Query() pagination: PaginationDto) {
    return this.commentsService.findAll(ticketId, pagination.page, pagination.limit);
  }

  @Post('tickets/:ticketId/comments')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Ajouter un commentaire public' })
  async create(@Param('ticketId') ticketId: string, @Body() dto: CreateCommentDto, @CurrentUser() user: JwtPayload) {
    return this.commentsService.create(ticketId, user.sub, dto.content);
  }

  @Patch('comments/:id')
  @ApiOperation({ summary: 'Modifier un commentaire' })
  async update(@Param('id') id: string, @Body() dto: UpdateCommentDto, @CurrentUser() user: JwtPayload) {
    return this.commentsService.update(id, user.sub, user.role, dto.content);
  }

  @Delete('comments/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Supprimer un commentaire' })
  async remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    await this.commentsService.remove(id, user.sub, user.role);
  }
}
