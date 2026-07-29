/**
 * ============================================================================
 * FICHIER : src/modules/attachments/storage/local-storage.service.spec.ts
 * RÔLE : Suite de tests unitaires pour le composant local-storage.service.
 * EXPLICATION :
 * Ce fichier contient les tests automatisés validant le comportement et l'intégrité de local-storage.service.
 * 1. Vérifie le fonctionnement nominal et les cas d'erreur.
 * 2. Garantit qu'aucune régression n'est introduite lors des évolutions du code.
 * ============================================================================
 */

import { LocalStorageService } from './local-storage.service';
import { promises as fs } from 'fs';
import * as path from 'path';

jest.mock('fs', () => ({
  promises: {
    mkdir: jest.fn().mockResolvedValue(undefined),
    writeFile: jest.fn().mockResolvedValue(undefined),
    readFile: jest.fn().mockResolvedValue(Buffer.from('test-content')),
    unlink: jest.fn().mockResolvedValue(undefined),
  },
}));

describe('LocalStorageService', () => {
  let service: LocalStorageService;
  const mockBasePath = './test-uploads';

  beforeEach(() => {
    jest.clearAllMocks();
    process.env['STORAGE_LOCAL_PATH'] = mockBasePath;
    service = new LocalStorageService();
  });

  describe('validation de chemin (anti-Path Traversal)', () => {
    it("doit accepter des clés d'objet valides", async () => {
      const mockFile = { buffer: Buffer.from('data') } as Express.Multer.File;
      const objectKey = 'user-123/avatar.png';

      const result = await service.upload(mockFile, objectKey);

      expect(result).toBe(objectKey);
      expect(fs.writeFile).toHaveBeenCalledWith(path.resolve(mockBasePath, objectKey), mockFile.buffer);
    });

    /** Test : doit lever une erreur si la clé contient un retour de répertoire (Path Traversal) */

    it('doit lever une erreur si la clé contient un retour de répertoire (Path Traversal)', async () => {
      const mockFile = { buffer: Buffer.from('data') } as Express.Multer.File;
      const dangerousKey = '../../etc/passwd';

      await expect(service.upload(mockFile, dangerousKey)).rejects.toThrow('Access Denied: Path Traversal Detected');
      expect(fs.writeFile).not.toHaveBeenCalled();
    });

    /** Test : doit rejeter les tentatives de Path Traversal lors du téléchargement */

    it('doit rejeter les tentatives de Path Traversal lors du téléchargement', async () => {
      const dangerousKey = '..\\..\\windows\\win.ini';

      await expect(service.download(dangerousKey)).rejects.toThrow('Access Denied: Path Traversal Detected');
      expect(fs.readFile).not.toHaveBeenCalled();
    });

    /** Test : doit rejeter les tentatives de Path Traversal lors de la suppression */

    it('doit rejeter les tentatives de Path Traversal lors de la suppression', async () => {
      const dangerousKey = 'folder/../../../some-file.txt';

      await expect(service.delete(dangerousKey)).rejects.toThrow('Access Denied: Path Traversal Detected');
      expect(fs.unlink).not.toHaveBeenCalled();
    });

    /** Test : doit nettoyer les octets nuls pour bloquer les contournements */

    it('doit nettoyer les octets nuls pour bloquer les contournements', async () => {
      const dangerousKey = 'file.png\0.txt';
      const mockFile = { buffer: Buffer.from('data') } as Express.Multer.File;

      const result = await service.upload(mockFile, dangerousKey);
      expect(result).toBe(dangerousKey);
      expect(fs.writeFile).toHaveBeenCalledWith(path.resolve(mockBasePath, 'file.png.txt'), mockFile.buffer);
    });
  });
});
