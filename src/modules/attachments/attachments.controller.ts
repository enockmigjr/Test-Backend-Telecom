/**
 * ============================================================================
 * FICHIER : src/modules/attachments/attachments.controller.ts
 * RÔLE : Contrôleur REST pour la gestion des pièces jointes (`/api/v1/attachments`).
 * EXPLICATION :
 * Ce contrôleur gère le transfert et la diffusion des pièces jointes associées aux tickets :
 * 1. Téléversement de fichiers (upload multipart/form-data) associés à un ticket, commentaire ou note interne.
 * 2. Liste paginée des pièces jointes accessibles selon les droits d'accès au ticket.
 * 3. Téléchargement forcé (`Content-Disposition: attachment`) ou prévisualisation directe (`inline`).
 * 4. Streaming sécurisé des fichiers physiques du disque avec en-têtes de sécurité (X-Content-Type-Options: nosniff).
 * 5. Suppression de pièces jointes sous contrôle d'accès.
 * ============================================================================
 */

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

/**
 * Contrôleur REST d'exposition des fichiers et pièces jointes du système.
 */
@ApiTags('attachments')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller()
export class AttachmentsController {
  constructor(private readonly attachmentsService: AttachmentsService) {}

  /**
   * Endpoint POST /attachments : Téléverse un fichier et le rattache à un ticket, commentaire ou note interne.
   *
   * @param file Fichier transmis dans le champ 'file' (intercepté par Multer).
   * @param association DTO contenant le ticketId, commentId ou internalNoteId.
   * @param user Utilisateur connecté effectuant l'upload.
   * @returns Métadonnées du fichier créé.
   */
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

  /**
   * Endpoint GET /tickets/:ticketId/attachments : Récupère la liste paginée des pièces jointes d'un ticket.
   * Masque les pièces jointes des notes internes si l'utilisateur est un technicien de terrain.
   *
   * @param ticketId UUID du ticket.
   * @param pagination Métadonnées de pagination (page, limit).
   * @param user Utilisateur demandeur.
   */
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

  /**
   * Endpoint GET /attachments/:id/download : Télécharge le fichier en tant que pièce jointe (Content-Disposition: attachment).
   *
   * @param id UUID de la pièce jointe.
   * @param user Utilisateur demandeur.
   * @param res Objet Response d'Express pour le streaming du fichier.
   */
  @Get('attachments/:id/download')
  @ApiOperation({ summary: 'Telecharger une piece jointe visible' })
  @ApiParam({ name: 'id', description: 'UUID de la piece jointe' })
  async download(@Param('id') id: string, @CurrentUser() user: JwtPayload, @Res() res: Response) {
    return this.streamFile(id, user, res, 'attachment');
  }

  /**
   * Endpoint GET /attachments/:id/preview : Prévisualise le fichier directement dans le navigateur (Content-Disposition: inline).
   *
   * @param id UUID de la pièce jointe.
   * @param user Utilisateur demandeur.
   * @param res Objet Response d'Express pour l'affichage inline.
   */
  @Get('attachments/:id/preview')
  @ApiOperation({ summary: 'Prévisualiser une pièce jointe visible' })
  @ApiParam({ name: 'id', description: 'UUID de la pièce jointe' })
  async preview(@Param('id') id: string, @CurrentUser() user: JwtPayload, @Res() res: Response) {
    return this.streamFile(id, user, res, 'inline');
  }

  /**
   * Méthode utilitaire interne pour diffuser le flux binaire d'un fichier physique vers le client.
   * Vérifie l'existence du fichier sur disque, configure les en-têtes HTTP de sécurité et gère les erreurs de flux.
   */
  private async streamFile(id: string, user: JwtPayload, res: Response, disposition: 'attachment' | 'inline') {
    // Vérification préalable que la pièce jointe existe et que l'utilisateur a le droit d'y accéder
    const attachment = await this.attachmentsService.findOneDownloadableForUser(id, user);
    const filePath = join(process.env['STORAGE_LOCAL_PATH'] || './uploads', attachment.objectKey);

    // Vérification de l'existence physique du fichier sur le serveur de fichiers local
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- objectKey is generated server-side
    if (!existsSync(filePath)) throw new NotFoundException('Le fichier physique est introuvable.');

    // En-têtes HTTP pour forcer le type MIME, le mode de téléchargement et se prémunir du sniffing de contenu
    res.setHeader('Content-Type', attachment.mimeType);
    res.setHeader('Content-Disposition', `${disposition}; filename="${attachment.originalFilename}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // Ouverture et redirection du flux binaire du fichier vers la réponse HTTP Express
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- objectKey is generated server-side
    const stream = createReadStream(filePath);
    stream.on('error', () => {
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Erreur de lecture.' } });
      }
    });
    stream.pipe(res);
  }

  /**
   * Endpoint DELETE /attachments/:id : Supprime une pièce jointe et son fichier physique associé.
   *
   * @param id UUID de la pièce jointe.
   * @param user Utilisateur effectuant la suppression.
   */
  @Delete('attachments/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Supprimer une piece jointe visible' })
  async remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    await this.attachmentsService.remove(id, user);
  }
}
