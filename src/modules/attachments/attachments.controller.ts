import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { createReadStream, existsSync } from 'fs';
import { join } from 'path';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { RolesGuard } from '../auth/guards/roles.guard';
import { attachmentUploadOptions } from './attachment-upload.config';
import { AttachmentsService } from './attachments.service';
import { UploadAttachmentDto } from './dto/upload-attachment.dto';

@ApiTags('attachments')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller()
export class AttachmentsController {
  constructor(private readonly attachmentsService: AttachmentsService) {}

  @Post('attachments')
  @UseInterceptors(FileInterceptor('file', attachmentUploadOptions))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary' },
        ticketId: { type: 'string', format: 'uuid' },
        commentId: { type: 'string', format: 'uuid' },
        internalNoteId: { type: 'string', format: 'uuid' },
      },
    },
  })
  @ApiOperation({ summary: 'Uploader une piece jointe' })
  @ApiResponse({ status: 201, description: 'Fichier uploade.' })
  @ApiResponse({ status: 400, description: 'Fichier ou association invalide.' })
  async upload(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() association: UploadAttachmentDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.attachmentsService.upload(file, user, association);
  }

  @Get('tickets/:ticketId/attachments')
  @ApiOperation({ summary: "Lister les pieces jointes visibles d'un ticket" })
  @ApiParam({ name: 'ticketId', description: 'UUID du ticket' })
  async findAllForTicket(
    @Param('ticketId') ticketId: string,
    @Query() pagination: PaginationDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.attachmentsService.findAllForTicket(ticketId, user, pagination.page, pagination.limit);
  }

  @Get('attachments/:id/download')
  @ApiOperation({ summary: 'Telecharger une piece jointe visible' })
  @ApiParam({ name: 'id', description: 'UUID de la piece jointe' })
  async download(@Param('id') id: string, @CurrentUser() user: JwtPayload, @Res() res: Response) {
    return this.streamFile(id, user, res, 'attachment');
  }

  @Get('attachments/:id/preview')
  @ApiOperation({ summary: 'Prévisualiser une pièce jointe visible' })
  @ApiParam({ name: 'id', description: 'UUID de la pièce jointe' })
  async preview(@Param('id') id: string, @CurrentUser() user: JwtPayload, @Res() res: Response) {
    return this.streamFile(id, user, res, 'inline');
  }

  private async streamFile(id: string, user: JwtPayload, res: Response, disposition: 'attachment' | 'inline') {
    const attachment = await this.attachmentsService.findOneForUser(id, user);
    const filePath = join(process.env['STORAGE_LOCAL_PATH'] || './uploads', attachment.objectKey);
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- objectKey is generated server-side
    if (!existsSync(filePath)) throw new NotFoundException('Le fichier physique est introuvable.');

    res.setHeader('Content-Type', attachment.mimeType);
    res.setHeader('Content-Disposition', `${disposition}; filename="${attachment.originalFilename}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- objectKey is generated server-side
    const stream = createReadStream(filePath);
    stream.on('error', () => {
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Erreur de lecture.' } });
      }
    });
    stream.pipe(res);
  }

  @Delete('attachments/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Supprimer une piece jointe visible' })
  async remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    await this.attachmentsService.remove(id, user);
  }
}
