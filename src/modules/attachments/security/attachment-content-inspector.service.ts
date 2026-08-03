import { BadRequestException, Injectable } from '@nestjs/common';
import { fromBuffer } from 'file-type';

const ALLOWED_BINARY = new Map([
  ['application/pdf', new Set(['pdf'])],
  ['image/jpeg', new Set(['jpg', 'jpeg'])],
  ['image/png', new Set(['png'])],
  ['image/webp', new Set(['webp'])],
]);

export interface InspectedAttachment {
  readonly mimeType: string;
  readonly extension: string;
}

@Injectable()
export class AttachmentContentInspectorService {
  async inspect(buffer: Buffer): Promise<InspectedAttachment> {
    const detected = await fromBuffer(buffer);
    if (detected) {
      const extensions = ALLOWED_BINARY.get(detected.mime);
      if (!extensions || !extensions.has(detected.ext)) {
        throw new BadRequestException('Le contenu réel du fichier est interdit.');
      }
      return { mimeType: detected.mime, extension: detected.ext === 'jpg' ? 'jpg' : detected.ext };
    }
    if (!this.isPlainText(buffer)) throw new BadRequestException('Type de fichier réel inconnu ou interdit.');
    return { mimeType: 'text/plain', extension: 'txt' };
  }

  private isPlainText(buffer: Buffer): boolean {
    if (buffer.length === 0 || buffer.includes(0)) return false;
    try {
      const text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
      for (const character of text) {
        const code = character.codePointAt(0) ?? 0;
        if (code < 32 && character !== '\n' && character !== '\r' && character !== '\t') return false;
      }
      return true;
    } catch {
      return false;
    }
  }
}
