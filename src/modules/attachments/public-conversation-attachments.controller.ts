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
import { PublicConversationAttachmentsService } from './public-conversation-attachments.service';
import { PublicAttachmentUploadGuard } from './public-attachment-upload.guard';
import { PublicAttachmentIdempotencyService } from './public-attachment-idempotency.service';

@ApiTags('Support public - pièces jointes pré-ticket')
@ApiBearerAuth('publicSession')
@Auth(AuthMode.PUBLIC_SESSION)
@Controller('public-support/conversations/:conversationId/attachments')
export class PublicConversationAttachmentsController {
  constructor(
    private readonly attachments: PublicConversationAttachmentsService,
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
  @ApiOperation({ summary: 'Déposer un fichier avant création du ticket' })
  @ApiCreatedResponse({ type: PublicAttachmentResponseDto })
  upload(
    @Param('conversationId', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() request: PublicSupportRequest,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    const principal = requirePublicPrincipal(request);
    return this.idempotency.execute(idempotencyKey, `conversations/${id}/attachments`, principal, file, (reservation) =>
      this.attachments.upload(id, principal, file, reservation),
    );
  }

  @Get()
  @PublicSupportApi()
  @ApiOperation({ summary: 'Lister les fichiers de la conversation' })
  @ApiOkResponse({ type: PublicAttachmentListResponseDto })
  list(@Param('conversationId', ParseUUIDPipe) id: string, @Req() request: PublicSupportRequest) {
    return this.attachments.list(id, requirePublicPrincipal(request));
  }

  @Get(':attachmentId/status')
  @PublicSupportApi()
  @ApiOperation({ summary: "Consulter l'état du scan" })
  @ApiOkResponse({ type: PublicAttachmentResponseDto })
  status(
    @Param('conversationId', ParseUUIDPipe) id: string,
    @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
    @Req() request: PublicSupportRequest,
  ) {
    return this.attachments.status(id, attachmentId, requirePublicPrincipal(request));
  }

  @Get(':attachmentId/download')
  @PublicSupportApi()
  @ApiOperation({ summary: 'Télécharger un fichier pré-ticket sain' })
  @ApiOkResponse({ schema: { type: 'string', format: 'binary' } })
  async download(
    @Param('conversationId', ParseUUIDPipe) id: string,
    @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
    @Req() request: PublicSupportRequest,
    @Res() response: Response,
  ) {
    const result = await this.attachments.download(id, attachmentId, requirePublicPrincipal(request));
    response.setHeader('Content-Type', result.attachment.mimeType);
    response.setHeader('Content-Disposition', `attachment; filename="${result.attachment.originalFilename}"`);
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Cache-Control', 'private, no-store');
    response.send(result.buffer);
  }
}
