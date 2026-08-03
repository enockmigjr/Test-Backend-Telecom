/**
 * ============================================================================
 * FICHIER : src/modules/attachments/storage/local-storage.service.ts
 * RÔLE : Implémentation du service de stockage de fichiers sur le système de fichiers local.
 * EXPLICATION :
 * Ce service concrétise l'interface abstraite `IStorageService` pour la sauvegarde physique des fichiers téléversés :
 * 1. `validatePath` : Sécurise la construction du chemin absolu en bloquant les tentatives d'escalade de répertoire (Path Traversal) via `path.resolve` et la vérification des préfixes.
 * 2. `upload` : Crée de manière récursive les répertoires cibles et écrit le tampon binaire (`Buffer`) de Multer sur le disque.
 * 3. `download` & `delete` : Lit ou supprime en toute sécurité les pièces jointes depuis le stockage local.
 * 4. `getUrl` : Construit l'URL REST d'accès au fichier pour le téléchargement.
 * ============================================================================
 */

import { Injectable, Logger } from '@nestjs/common';
import { promises as fs } from 'fs';
import * as path from 'path';
import { IStorageService } from './storage.interface';

/**
 * Fournisseur de stockage local implémentant le contrat `IStorageService`.
 */
@Injectable()
export class LocalStorageService implements IStorageService {
  private readonly logger = new Logger(LocalStorageService.name);
  private readonly basePath: string;

  constructor() {
    this.basePath = process.env['STORAGE_LOCAL_PATH'] || './uploads';
  }

  /**
   * Normalise et valide le chemin d'accès au fichier pour prémunir l'application contre les attaques de Path Traversal.
   *
   * @param objectKey La clé relative ou le chemin du fichier cible.
   * @returns Le chemin absolu sécurisé sur le disque.
   * @throws Error Si la clé tente d'accéder à un répertoire parent en dehors de `STORAGE_LOCAL_PATH`.
   */
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

  /**
   * Écrit un fichier téléversé par l'utilisateur sur le système de fichiers.
   *
   * @param file Le fichier intercepté par Multer.
   * @param objectKey Clé d'identification du stockage.
   * @returns La clé d'accès finale au fichier.
   */
  async upload(file: Express.Multer.File, objectKey: string): Promise<string> {
    const fullPath = this.validatePath(objectKey);
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- fullPath validé par validatePath() contre le path traversal
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- fullPath est validé par validatePath() contre le path traversal
    await fs.writeFile(fullPath, file.buffer);
    this.logger.log(`Fichier sauvegardé: ${objectKey}`);
    return objectKey;
  }

  async quarantine(file: Express.Multer.File, objectKey: string): Promise<string> {
    const quarantineKey = `quarantine/${objectKey}`;
    if (!file.path) return this.upload(file, quarantineKey);
    const target = this.validatePath(quarantineKey);
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- cible validée et source produite par Multer
    await fs.mkdir(path.dirname(target), { recursive: true });
    try {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- cible validée et source produite par Multer
      await fs.rename(file.path, target);
    } catch (error: unknown) {
      await this.discardIncoming(file);
      throw error;
    }
    return quarantineKey;
  }

  async readQuarantine(objectKey: string): Promise<Buffer> {
    return this.download(objectKey);
  }

  async promote(quarantineKey: string, cleanObjectKey: string): Promise<string> {
    const source = this.validatePath(quarantineKey);
    const target = this.validatePath(cleanObjectKey);
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- chemins validés contre le path traversal
    await fs.mkdir(path.dirname(target), { recursive: true });
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- chemins validés contre le path traversal
    await fs.copyFile(source, target);
    return cleanObjectKey;
  }

  async deleteQuarantine(objectKey: string): Promise<void> {
    await this.delete(objectKey);
  }

  async discardIncoming(file: Express.Multer.File): Promise<void> {
    if (!file.path) return;
    try {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- chemin créé par Multer dans le dossier incoming
      await fs.unlink(file.path);
    } catch (error: unknown) {
      if (!isErrorCode(error, 'ENOENT')) throw error;
    }
  }

  async cleanupIncoming(olderThan: Date): Promise<number> {
    const incomingPath = this.validatePath('incoming');
    let entries;
    try {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- chemin validé contre le path traversal
      entries = await fs.readdir(incomingPath);
    } catch (error: unknown) {
      if (isErrorCode(error, 'ENOENT')) return 0;
      throw error;
    }
    let deleted = 0;
    for (const entry of entries) {
      const filePath = this.validatePath(`incoming/${entry}`);
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- chemin validé contre le path traversal
      const metadata = await fs.stat(filePath);
      if (!metadata.isFile() || metadata.mtime >= olderThan) continue;
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- chemin validé contre le path traversal
      await fs.unlink(filePath);
      deleted += 1;
    }
    return deleted;
  }

  /**
   * Lit le contenu binaire d'un fichier stocké en local.
   *
   * @param objectKey Clé unique du fichier.
   * @returns Le tampon de données (`Buffer`).
   */
  async download(objectKey: string): Promise<Buffer> {
    const fullPath = this.validatePath(objectKey);
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- fullPath est validé par validatePath() contre le path traversal
    return fs.readFile(fullPath);
  }

  /**
   * Supprime un fichier physique du stockage local.
   *
   * @param objectKey Clé du fichier à supprimer.
   */
  async delete(objectKey: string): Promise<void> {
    const fullPath = this.validatePath(objectKey);
    try {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- fullPath est validé par validatePath() contre le path traversal
      await fs.unlink(fullPath);
    } catch (error: unknown) {
      if (isErrorCode(error, 'ENOENT')) {
        this.logger.warn(`Fichier non trouvé pour suppression: ${objectKey}`);
        return;
      }
      throw error;
    }
  }

  /**
   * Génère l'URL d'accès HTTP REST au fichier téléversé.
   */
  async getUrl(objectKey: string): Promise<string> {
    return `/api/v1/attachments/${objectKey}/download`;
  }
}

function isErrorCode(error: unknown, code: string): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === code;
}
