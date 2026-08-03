import {
  Controller,
  Get,
  Headers,
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
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Response } from 'express';
import { Auth, AuthMode } from '../../common/decorators/auth-mode.decorator';
import { PublicSupportApi } from '../../common/openapi/public-support-api.decorator';
import { PublicSupportRequest, requirePublicPrincipal } from '../public-support/public-request';
import {
  PublicAttachmentListResponseDto,
  PublicAttachmentResponseDto,
} from '../public-support/dto/public-attachment-response.dto';
import { publicAttachmentUploadOptions } from './attachment-upload.config';
import { PublicAttachmentsService } from './public-attachments.service';
import { PublicAttachmentUploadGuard } from './public-attachment-upload.guard';
import { PublicAttachmentIdempotencyService } from './public-attachment-idempotency.service';

@ApiTags('Support public - pièces jointes')
@ApiBearerAuth('publicSession')
@Auth(AuthMode.PUBLIC_SESSION)
@Controller('public-support/tickets/:ticketId/attachments')
export class PublicAttachmentsController {
  constructor(
    private readonly attachments: PublicAttachmentsService,
    private readonly idempotency: PublicAttachmentIdempotencyService,
  ) {}

  @Post()
  @PublicSupportApi()
  @UseGuards(PublicAttachmentUploadGuard)
  @UseInterceptors(FileInterceptor('file', publicAttachmentUploadOptions))
  @ApiConsumes('multipart/form-data')
  @ApiHeader({ name: 'Idempotency-Key', required: true, description: 'Clé unique liée au contenu réel du fichier.' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiOperation({ summary: 'Déposer une pièce jointe en quarantaine' })
  @ApiCreatedResponse({ type: PublicAttachmentResponseDto })
  upload(
    @Param('ticketId', ParseUUIDPipe) ticketId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() request: PublicSupportRequest,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    const principal = requirePublicPrincipal(request);
    return this.idempotency.execute(idempotencyKey, `tickets/${ticketId}/attachments`, principal, file, (reservation) =>
      this.attachments.upload(ticketId, principal, file, reservation),
    );
  }

  @Get()
  @PublicSupportApi()
  @ApiOperation({ summary: 'Lister les pièces jointes et leur état de scan' })
  @ApiOkResponse({ type: PublicAttachmentListResponseDto })
  list(@Param('ticketId', ParseUUIDPipe) ticketId: string, @Req() request: PublicSupportRequest) {
    return this.attachments.list(ticketId, requirePublicPrincipal(request));
  }

  @Get(':attachmentId/status')
  @PublicSupportApi()
  @ApiOperation({ summary: "Consulter l'état d'analyse d'une pièce jointe" })
  @ApiOkResponse({ type: PublicAttachmentResponseDto })
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
  @ApiOkResponse({ schema: { type: 'string', format: 'binary' } })
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
