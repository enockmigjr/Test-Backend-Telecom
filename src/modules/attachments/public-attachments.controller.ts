import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { Auth, AuthMode } from '../../common/decorators/auth-mode.decorator';
import { PublicSupportApi } from '../../common/openapi/public-support-api.decorator';
import { PublicSupportRequest, requirePublicPrincipal } from '../public-support/public-request';
import { publicAttachmentUploadOptions } from './attachment-upload.config';
import { PublicAttachmentsService } from './public-attachments.service';
import { PublicAttachmentUploadGuard } from './public-attachment-upload.guard';

@ApiTags('Support public - pièces jointes')
@ApiBearerAuth('publicSession')
@Auth(AuthMode.PUBLIC_SESSION)
@Controller('public-support/tickets/:ticketId/attachments')
export class PublicAttachmentsController {
  constructor(private readonly attachments: PublicAttachmentsService) {}

  @Post()
  @PublicSupportApi()
  @UseGuards(PublicAttachmentUploadGuard)
  @UseInterceptors(FileInterceptor('file', publicAttachmentUploadOptions))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Déposer une pièce jointe en quarantaine' })
  upload(
    @Param('ticketId', ParseUUIDPipe) ticketId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() request: PublicSupportRequest,
  ) {
    return this.attachments.upload(ticketId, requirePublicPrincipal(request), file);
  }

  @Get()
  @PublicSupportApi()
  @ApiOperation({ summary: 'Lister les pièces jointes et leur état de scan' })
  list(@Param('ticketId', ParseUUIDPipe) ticketId: string, @Req() request: PublicSupportRequest) {
    return this.attachments.list(ticketId, requirePublicPrincipal(request));
  }

  @Get(':attachmentId/status')
  @PublicSupportApi()
  @ApiOperation({ summary: "Consulter l'état d'analyse d'une pièce jointe" })
  status(
    @Param('ticketId', ParseUUIDPipe) ticketId: string,
    @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
    @Req() request: PublicSupportRequest,
  ) {
    return this.attachments.status(ticketId, attachmentId, requirePublicPrincipal(request));
  }

  @Get(':attachmentId/download')
  @PublicSupportApi()
  @ApiOperation({ summary: 'Télécharger uniquement une pièce jointe déclarée saine' })
  async download(
    @Param('ticketId', ParseUUIDPipe) ticketId: string,
    @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
    @Req() request: PublicSupportRequest,
    @Res() response: Response,
  ) {
    const result = await this.attachments.download(ticketId, attachmentId, requirePublicPrincipal(request));
    response.setHeader('Content-Type', result.attachment.mimeType);
    response.setHeader('Content-Disposition', `attachment; filename="${result.attachment.originalFilename}"`);
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Cache-Control', 'private, no-store');
    response.send(result.buffer);
  }
}
