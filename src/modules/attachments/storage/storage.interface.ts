/**
 * ============================================================================
 * FICHIER : src/modules/attachments/storage/storage.interface.ts
 * RÔLE : Définitions de types, interfaces ou règles de domaine TypeScript.
 * EXPLICATION :
 * Ce fichier définit les structures de données, types stricts ou exceptions métier du domaine.
 * 1. Assure la cohérence des types à travers tout l'applicatif.
 * 2. Facilite l'auto-complétion et la détection d'erreurs à la compilation.
 * ============================================================================
 */

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
