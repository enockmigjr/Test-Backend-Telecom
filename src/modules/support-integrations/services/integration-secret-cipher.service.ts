import { Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { PublicSupportConfigService } from '../../../config/public-support.config';

@Injectable()
export class IntegrationSecretCipherService {
  constructor(private readonly config: PublicSupportConfigService) {}

  seal(secret: string, context: string): { encryptedSecret: string; keyVersion: number } {
    const keyVersion = this.config.currentMasterKeyVersion;
    const key = this.requireKey(keyVersion);
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    cipher.setAAD(Buffer.from(context));
    const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
    return {
      encryptedSecret: [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString('base64url')).join('.'),
      keyVersion,
    };
  }

  open(encryptedSecret: string, keyVersion: number, context: string): string {
    const parts = encryptedSecret.split('.').map((part) => Buffer.from(part, 'base64url'));
    const [iv, tag, encrypted] = parts;
    if (!iv || !tag || !encrypted || iv.length !== 12 || tag.length !== 16) throw new Error('Secret chiffré invalide.');
    const decipher = createDecipheriv('aes-256-gcm', this.requireKey(keyVersion), iv);
    decipher.setAAD(Buffer.from(context));
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
  }

  private requireKey(version: number): Buffer {
    const key = this.config.masterKeys.get(version);
    if (!key) throw new Error(`Clé maîtresse ${version} indisponible.`);
    return key;
  }
}
