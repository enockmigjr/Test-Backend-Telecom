/**
 * ============================================================================
 * FICHIER : src/modules/attachments/attachment-upload.config.ts
 * RÔLE : Configuration de la sécurité et des filtres de téléversement de fichiers Multer.
 * EXPLICATION :
 * Ce module définit la politique de validation des pièces jointes associées aux tickets :
 * 1. Restreint les types MIME autorisés aux formats sécurisés : PDF, JPEG, PNG, WEBP et TXT.
 * 2. Vérifie la concordance stricte entre le type MIME et l'extension du fichier (détection du MIME-spoofing).
 * 3. Limite la taille maximale de chaque pièce jointe à 10 Mo (`MAX_ATTACHMENT_SIZE`).
 * ============================================================================
 */

import { BadRequestException } from '@nestjs/common';
import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { extname } from 'path';
import { resolve } from 'path';
import { mkdirSync } from 'fs';
import { diskStorage } from 'multer';
import { generateUuid } from '../../common/helpers/uuidv7.helper';

/** Dictionnaire immuable associant chaque type MIME aux extensions de fichier autorisées. */
const ALLOWED_MIME_EXTENSIONS: Readonly<Record<string, readonly string[]>> = {
  'application/pdf': ['.pdf'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
  'text/plain': ['.txt'],
};

/** Taille maximale autorisée par fichier joint (10 Mo = 10 485 760 octets). */
export const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;

/**
 * Valide que le fichier téléversé possède un type MIME autorisé et une extension cohérente.
 *
 * @param file Objet fichier partiel de Multer (`mimetype` et `originalname`).
 * @returns `true` si le fichier est conforme aux règles de sécurité.
 */
export function isAllowedAttachment(file: Pick<Express.Multer.File, 'mimetype' | 'originalname'>): boolean {
  const extensions = ALLOWED_MIME_EXTENSIONS[file.mimetype];
  return Boolean(extensions?.includes(extname(file.originalname).toLowerCase()));
}

/**
 * Options de configuration transmises au middleware `FileInterceptor` de NestJS / Multer.
 */
export const attachmentUploadOptions: MulterOptions = {
  limits: { fileSize: MAX_ATTACHMENT_SIZE, files: 1 },
  fileFilter: (_request, file, callback) => {
    if (!isAllowedAttachment(file)) {
      callback(new BadRequestException('Type de fichier non autorisé.'), false);
      return;
    }
    callback(null, true);
  },
};

/** Le public est contrôlé sur son contenu réel après écriture en quarantaine. */
export const publicAttachmentUploadOptions: MulterOptions = {
  storage: diskStorage({
    destination: (_request, _file, callback) => {
      const directory = resolve(process.env['STORAGE_LOCAL_PATH'] || './uploads', 'incoming');
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- chemin serveur fixe issu de la configuration
      mkdirSync(directory, { recursive: true });
      callback(null, directory);
    },
    filename: (_request, _file, callback) => callback(null, generateUuid()),
  }),
  limits: { fileSize: MAX_ATTACHMENT_SIZE, files: 1 },
};
