import { BadRequestException } from '@nestjs/common';
import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { extname } from 'path';

const ALLOWED_MIME_EXTENSIONS: Readonly<Record<string, readonly string[]>> = {
  'application/pdf': ['.pdf'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
  'text/plain': ['.txt'],
};

export const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;

export function isAllowedAttachment(file: Pick<Express.Multer.File, 'mimetype' | 'originalname'>): boolean {
  const extensions = ALLOWED_MIME_EXTENSIONS[file.mimetype];
  return Boolean(extensions?.includes(extname(file.originalname).toLowerCase()));
}

export const attachmentUploadOptions: MulterOptions = {
  limits: { fileSize: MAX_ATTACHMENT_SIZE, files: 1 },
  fileFilter: (_request, file, callback) => {
    if (!isAllowedAttachment(file)) {
      callback(new BadRequestException('Type de fichier non autorise.'), false);
      return;
    }
    callback(null, true);
  },
};
