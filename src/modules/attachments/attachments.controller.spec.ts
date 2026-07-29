/**
 * ============================================================================
 * FICHIER : src/modules/attachments/attachments.controller.spec.ts
 * RÔLE : Suite de tests unitaires pour le composant attachments.controller.
 * EXPLICATION :
 * Ce fichier contient les tests automatisés validant le comportement et l'intégrité de attachments.controller.
 * 1. Vérifie le fonctionnement nominal et les cas d'erreur.
 * 2. Garantit qu'aucune régression n'est introduite lors des évolutions du code.
 * ============================================================================
 */

import { Test } from '@nestjs/testing';
import { mock, MockProxy } from 'jest-mock-extended';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { AttachmentsController } from './attachments.controller';
import { AttachmentsService } from './attachments.service';

const user: JwtPayload = {
  sub: 'agent-001',
  email: 'agent@telecom.local',
  role: 'CUSTOMER_SERVICE_AGENT',
  departmentId: 'dept-001',
  mustChangePassword: false,
  jti: 'jti-001',
};

const file: Express.Multer.File = {
  fieldname: 'file',
  originalname: 'incident.pdf',
  encoding: '7bit',
  mimetype: 'application/pdf',
  size: 4,
  buffer: Buffer.from('test'),
  destination: '',
  filename: '',
  path: '',
  stream: undefined as never,
};
const attachment = {
  id: 'attachment-001',
  ticketId: '019f28ea-9e12-7cc0-a0ea-3d4de79e7a95',
  commentId: null,
  internalNoteId: null,
  uploadedBy: user.sub,
  objectKey: 'tickets/2026/07/attachment-001-incident.pdf',
  bucketName: 'default',
  originalFilename: 'incident.pdf',
  mimeType: 'application/pdf',
  fileSize: 4,
  createdAt: new Date(),
};

describe('AttachmentsController', () => {
  let controller: AttachmentsController;
  let service: MockProxy<AttachmentsService>;

  beforeEach(async () => {
    service = mock<AttachmentsService>();
    const moduleRef = await Test.createTestingModule({
      controllers: [AttachmentsController],
      providers: [{ provide: AttachmentsService, useValue: service }],
    }).compile();
    controller = moduleRef.get(AttachmentsController);
  });

  /** Test : lit les identifiants de rattachement dans le body multipart */

  it('lit les identifiants de rattachement dans le body multipart', async () => {
    service.upload.mockResolvedValue({ message: 'Fichier uploade.', data: attachment });
    await controller.upload(file, { ticketId: '019f28ea-9e12-7cc0-a0ea-3d4de79e7a95' }, user);
    expect(service.upload).toHaveBeenCalledWith(file, user, { ticketId: '019f28ea-9e12-7cc0-a0ea-3d4de79e7a95' });
  });

  /** Test : transmet le contexte utilisateur au listing */

  it('transmet le contexte utilisateur au listing', async () => {
    service.findAllForTicket.mockResolvedValue({ data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } });
    await controller.findAllForTicket('ticket-001', { page: 1, limit: 20 }, user);
    expect(service.findAllForTicket).toHaveBeenCalledWith('ticket-001', user, 1, 20);
  });

  /** Test : transmet le contexte utilisateur a la suppression */

  it('transmet le contexte utilisateur a la suppression', async () => {
    service.remove.mockResolvedValue(undefined);
    await controller.remove('attachment-001', user);
    expect(service.remove).toHaveBeenCalledWith('attachment-001', user);
  });
});
