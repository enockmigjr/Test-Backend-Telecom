/* eslint-disable security/detect-non-literal-fs-filename */
import { Injectable, Logger } from '@nestjs/common';
import { promises as fs } from 'fs';
import * as path from 'path';
import { IStorageService } from './storage.interface';

@Injectable()
export class LocalStorageService implements IStorageService {
  private readonly logger = new Logger(LocalStorageService.name);
  private readonly basePath: string;

  constructor() {
    this.basePath = process.env['STORAGE_LOCAL_PATH'] || './uploads';
  }

  private validatePath(objectKey: string): string {
    // Normaliser les antislashs (\) en slashs (/) pour compatibilité multiplateforme
    const normalizedKey = objectKey.replace(/\\/g, '/');
    // Supprimer les octets nuls (\0) pour éviter les contournements d'extension ou de chemin
    const safeKey = normalizedKey.replace(/\0/g, '');
    const absoluteBase = path.resolve(this.basePath);
    const resolvedPath = path.resolve(path.join(absoluteBase, safeKey));

    // S'assurer que le chemin résolu commence par le chemin de base absolu
    if (!resolvedPath.startsWith(absoluteBase)) {
      throw new Error('Access Denied: Path Traversal Detected');
    }
    return resolvedPath;
  }

  async upload(file: Express.Multer.File, objectKey: string): Promise<string> {
    const fullPath = this.validatePath(objectKey);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, file.buffer);
    this.logger.log(`Fichier sauvegardé: ${objectKey}`);
    return objectKey;
  }

  async download(objectKey: string): Promise<Buffer> {
    const fullPath = this.validatePath(objectKey);
    return fs.readFile(fullPath);
  }

  async delete(objectKey: string): Promise<void> {
    const fullPath = this.validatePath(objectKey);
    try {
      await fs.unlink(fullPath);
    } catch {
      this.logger.warn(`Fichier non trouvé pour suppression: ${objectKey}`);
    }
  }

  async getUrl(objectKey: string): Promise<string> {
    return `/api/v1/attachments/${objectKey}/download`;
  }
}
