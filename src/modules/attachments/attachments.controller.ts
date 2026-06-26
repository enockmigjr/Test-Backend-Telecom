import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  UploadedFile,
  UseInterceptors,
  HttpCode,
  HttpStatus,
  Res,
  Query,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { Response } from 'express';
import { AttachmentsService } from './attachments.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

@ApiTags('attachments')
@ApiBearerAuth()
@Controller('attachments')
export class AttachmentsController {
  constructor(private readonly attachmentsService: AttachmentsService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Uploader une pièce jointe' })
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: JwtPayload,
    @Query('ticketId') ticketId?: string,
    @Query('commentId') commentId?: string,
    @Query('internalNoteId') internalNoteId?: string,
  ) {
    return this.attachmentsService.upload(file, user.sub, ticketId, commentId, internalNoteId);
  }

  @Get(':id/download')
  @ApiOperation({ summary: 'Télécharger une pièce jointe' })
  async download(@Param('id') id: string, @Res() res: Response) {
    const att = await this.attachmentsService.findOne(id);
    const buffer = await this.attachmentsService.download(id);
    res.setHeader('Content-Type', att.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${att.originalFilename}"`);
    res.send(buffer);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Supprimer une pièce jointe' })
  async remove(@Param('id') id: string) {
    await this.attachmentsService.remove(id);
  }
}
