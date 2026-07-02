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

  async upload(file: Express.Multer.File, objectKey: string): Promise<string> {
    const fullPath = path.join(this.basePath, objectKey);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, file.buffer);
    this.logger.log(`Fichier sauvegardé: ${objectKey}`);
    return objectKey;
  }

  async download(objectKey: string): Promise<Buffer> {
    return fs.readFile(path.join(this.basePath, objectKey));
  }

  async delete(objectKey: string): Promise<void> {
    const fullPath = path.join(this.basePath, objectKey);
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
