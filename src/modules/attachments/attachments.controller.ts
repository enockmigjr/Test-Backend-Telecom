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
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody, ApiQuery, ApiParam, ApiResponse } from '@nestjs/swagger';
import { Response } from 'express';
import { createReadStream } from 'fs';
import { join } from 'path';
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
  @ApiBody({
    description: 'Fichier à uploader avec les identifiants de rattachement',
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary', description: 'Fichier à uploader' },
        ticketId: { type: 'string', description: 'UUID du ticket (optionnel si lié à un commentaire)' },
        commentId: { type: 'string', description: 'UUID du commentaire (optionnel)' },
        internalNoteId: { type: 'string', description: 'UUID de la note interne (optionnel)' },
      },
    },
  })
  @ApiOperation({
    summary: 'Uploader une pièce jointe',
    description:
      'Upload un fichier et le rattache à un ticket, un commentaire ou une note interne.\n\nLe fichier est stocké localement dans le répertoire configuré (STORAGE_LOCAL_PATH).\n\n**Rôles autorisés :** Tous les rôles authentifiés',
  })
  @ApiQuery({ name: 'ticketId', required: false, description: 'UUID du ticket de destination' })
  @ApiQuery({ name: 'commentId', required: false, description: 'UUID du commentaire' })
  @ApiQuery({ name: 'internalNoteId', required: false, description: 'UUID de la note interne' })
  @ApiResponse({ status: 201, description: 'Fichier uploadé avec succès.' })
  @ApiResponse({ status: 400, description: 'Aucun fichier fourni ou fichier trop volumineux.' })
  @ApiResponse({ status: 401, description: 'Token JWT manquant ou expiré.' })
  @ApiResponse({ status: 403, description: 'Rôle insuffisant.' })
  @ApiResponse({ status: 413, description: 'Fichier trop volumineux (limite configurée).' })
  @ApiResponse({ status: 429, description: 'Limite de requêtes dépassée.' })
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
  @ApiOperation({
    summary: 'Télécharger une pièce jointe (streaming)',
    description:
      'Télécharge un fichier préalablement uploadé. Le fichier est diffusé en streaming sans être chargé entièrement en mémoire.\n\n**Rôles autorisés :** Tous les rôles authentifiés',
  })
  @ApiParam({ name: 'id', description: 'UUID de la pièce jointe', example: '01922b3c-...' })
  @ApiResponse({ status: 200, description: 'Fichier téléchargé avec succès (streaming).' })
  @ApiResponse({ status: 401, description: 'Token JWT manquant ou expiré.' })
  @ApiResponse({ status: 403, description: 'Rôle insuffisant.' })
  @ApiResponse({ status: 404, description: 'Pièce jointe non trouvée.' })
  @ApiResponse({ status: 429, description: 'Limite de requêtes dépassée.' })
  async download(@Param('id') id: string, @Res() res: Response) {
    const att = await this.attachmentsService.findOne(id);
    const filePath = join(process.env['STORAGE_LOCAL_PATH'] || './uploads', att.objectKey);
    res.setHeader('Content-Type', att.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${att.originalFilename}"`);
    // Streaming — ne charge pas le fichier entier en RAM
    const stream = createReadStream(filePath);
    stream.pipe(res);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Supprimer une pièce jointe',
    description:
      'Supprime une pièce jointe de la base de données et du disque.\n\n**Rôles autorisés :** Tous les rôles authentifiés',
  })
  @ApiParam({ name: 'id', description: 'UUID de la pièce jointe' })
  @ApiResponse({ status: 204, description: 'Pièce jointe supprimée.' })
  @ApiResponse({ status: 401, description: 'Token JWT manquant ou expiré.' })
  @ApiResponse({ status: 403, description: 'Rôle insuffisant.' })
  @ApiResponse({ status: 404, description: 'Pièce jointe non trouvée.' })
  @ApiResponse({ status: 429, description: 'Limite de requêtes dépassée.' })
  async remove(@Param('id') id: string) {
    await this.attachmentsService.remove(id);
  }
}
