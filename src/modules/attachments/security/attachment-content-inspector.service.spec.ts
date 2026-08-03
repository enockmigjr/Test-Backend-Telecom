import { BadRequestException } from '@nestjs/common';
import { AttachmentContentInspectorService } from './attachment-content-inspector.service';

describe('AttachmentContentInspectorService', () => {
  const service = new AttachmentContentInspectorService();

  it.each([
    ['PDF', Buffer.from('%PDF-1.7\n1 0 obj\n<<>>\nendobj'), 'application/pdf', 'pdf'],
    ['JPEG', Buffer.from([0xff, 0xd8, 0xff, 0xdb, 0, 4, 0, 0]), 'image/jpeg', 'jpg'],
    [
      'PNG',
      Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
        'base64',
      ),
      'image/png',
      'png',
    ],
    [
      'WebP',
      Buffer.from([0x52, 0x49, 0x46, 0x46, 0x0c, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x20]),
      'image/webp',
      'webp',
    ],
  ])('accepte une signature binaire %s autorisee', async (_name, buffer, mimeType, extension) => {
    await expect(service.inspect(buffer)).resolves.toEqual({ mimeType, extension });
  });

  it('accepte un texte UTF-8 avec tabulations et retours a la ligne', async () => {
    await expect(service.inspect(Buffer.from('Incident fibre\nClient: Café\tPrioritaire', 'utf8'))).resolves.toEqual({
      mimeType: 'text/plain',
      extension: 'txt',
    });
  });

  it.each([
    ['archive ZIP deguisee', Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0, 0, 0])],
    ['executable PE deguise', Buffer.from([0x4d, 0x5a, 0x90, 0, 0x03, 0, 0, 0])],
    ['texte contenant un octet nul', Buffer.from([0x41, 0, 0x42])],
    ['texte contenant un controle interdit', Buffer.from([0x41, 0x07, 0x42])],
    ['sequence UTF-8 invalide', Buffer.from([0xc3, 0x28])],
    ['fichier vide', Buffer.alloc(0)],
  ])('rejette un contenu interdit: %s', async (_name, buffer) => {
    await expect(service.inspect(buffer)).rejects.toBeInstanceOf(BadRequestException);
  });
});
