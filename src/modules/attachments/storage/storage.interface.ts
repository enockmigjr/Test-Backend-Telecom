/**
 * Interface abstraite pour le stockage de fichiers.
 * Permet de basculer entre stockage local, S3, MinIO, etc.
 */
export interface IStorageService {
  upload(file: Express.Multer.File, objectKey: string): Promise<string>;
  download(objectKey: string): Promise<Buffer>;
  delete(objectKey: string): Promise<void>;
  getUrl(objectKey: string): Promise<string>;
}
