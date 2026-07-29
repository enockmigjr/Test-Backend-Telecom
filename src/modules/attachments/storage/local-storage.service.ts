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
    } catch {
      this.logger.warn(`Fichier non trouvé pour suppression: ${objectKey}`);
    }
  }

  /**
   * Génère l'URL d'accès HTTP REST au fichier téléversé.
   */
  async getUrl(objectKey: string): Promise<string> {
    return `/api/v1/attachments/${objectKey}/download`;
  }
}
