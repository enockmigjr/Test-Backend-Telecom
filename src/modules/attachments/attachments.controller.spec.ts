/* eslint-disable @typescript-eslint/no-explicit-any */
import { Test, TestingModule } from '@nestjs/testing';
import { AttachmentsController } from './attachments.controller';
import { AttachmentsService } from './attachments.service';
import { mock, MockProxy } from 'jest-mock-extended';
import { Response } from 'express';
import { createReadStream } from 'fs';
import { join } from 'path';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
jest.mock('fs', () => ({
  createReadStream: jest.fn(),
}));

jest.mock('path', () => ({
  join: jest.fn(),
}));

const mockUser: JwtPayload = {
  sub: 'user-001',
  email: 'agent@telecom.local',
  role: 'CUSTOMER_SERVICE_AGENT',
  departmentId: 'dept-001',
  jti: 'jti-001',
};

const mockFile: Express.Multer.File = {
  fieldname: 'file',
  originalname: 'rapport-incident.pdf',
  mimetype: 'application/pdf',
  size: 102400,
  buffer: Buffer.from('fake-content'),
  encoding: '7bit',
  destination: '',
  filename: '',
  path: '',
  stream: null as any,
};

const mockAttachmentRecord = {
  id: 'att-001',
  ticketId: 'ticket-001',
  commentId: null,
  internalNoteId: null,
  uploadedBy: 'user-001',
  objectKey: 'tickets/2026/01/uuid-rapport-incident.pdf',
  bucketName: 'default',
  originalFilename: 'rapport-incident.pdf',
  mimeType: 'application/pdf',
  fileSize: 102400,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

const uploadResult = {
  message: 'Fichier uploadé avec succès.',
  data: mockAttachmentRecord,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('AttachmentsController', () => {
  let controller: AttachmentsController;
  let attachmentsService: MockProxy<AttachmentsService>;

  beforeEach(async () => {
    attachmentsService = mock<AttachmentsService>();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AttachmentsController],
      providers: [{ provide: AttachmentsService, useValue: attachmentsService }],
    }).compile();

    controller = module.get<AttachmentsController>(AttachmentsController);

    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // =========================================================================
  // upload() — POST /attachments
  // =========================================================================
  describe('POST /attachments — Upload', () => {
    it('doit uploader un fichier avec succes', async () => {
      attachmentsService.upload.mockResolvedValue(uploadResult);

      const result = await controller.upload(mockFile, mockUser, 'ticket-001', undefined, undefined);

      expect(attachmentsService.upload).toHaveBeenCalledWith(
        mockFile,
        mockUser.sub,
        'ticket-001',
        undefined,
        undefined,
      );
      expect(result).toEqual(uploadResult);
    });

    it('doit utiliser le sub du JWT comme uploadedBy', async () => {
      attachmentsService.upload.mockResolvedValue(uploadResult);

      await controller.upload(mockFile, mockUser, undefined, undefined, undefined);

      expect(attachmentsService.upload).toHaveBeenCalledWith(mockFile, mockUser.sub, undefined, undefined, undefined);
    });

    it('doit accepter un commentId en parametre', async () => {
      attachmentsService.upload.mockResolvedValue(uploadResult);

      await controller.upload(mockFile, mockUser, undefined, 'comment-001', undefined);

      expect(attachmentsService.upload).toHaveBeenCalledWith(
        mockFile,
        mockUser.sub,
        undefined,
        'comment-001',
        undefined,
      );
    });

    it('doit accepter un internalNoteId en parametre', async () => {
      attachmentsService.upload.mockResolvedValue(uploadResult);

      await controller.upload(mockFile, mockUser, undefined, undefined, 'note-001');

      expect(attachmentsService.upload).toHaveBeenCalledWith(mockFile, mockUser.sub, undefined, undefined, 'note-001');
    });

    it('doit accepter tous les parametres optionnels simultanement', async () => {
      attachmentsService.upload.mockResolvedValue(uploadResult);

      await controller.upload(mockFile, mockUser, 'ticket-001', 'comment-001', 'note-001');

      expect(attachmentsService.upload).toHaveBeenCalledWith(
        mockFile,
        mockUser.sub,
        'ticket-001',
        'comment-001',
        'note-001',
      );
    });

    it('doit propager les erreurs du service', async () => {
      attachmentsService.upload.mockRejectedValue(new Error("Echec de l'upload"));

      await expect(controller.upload(mockFile, mockUser, 'ticket-001', undefined, undefined)).rejects.toThrow(
        "Echec de l'upload",
      );
    });
  });

  // =========================================================================
  // download() — GET /attachments/:id/download
  // =========================================================================
  describe('GET /attachments/:id/download — Download', () => {
    function makeMockResponse(): Partial<Response> {
      return {
        setHeader: jest.fn(),
        pipe: jest.fn(),
      };
    }

    it('doit diffuser le fichier avec les bons headers', async () => {
      attachmentsService.findOne.mockResolvedValue(mockAttachmentRecord);
      (join as jest.Mock).mockReturnValue('/uploads/tickets/2026/01/uuid-rapport-incident.pdf');
      const mockStream = { pipe: jest.fn() } as any;
      (createReadStream as jest.Mock).mockReturnValue(mockStream);
      const res = makeMockResponse() as Response;

      await controller.download('att-001', res);

      expect(attachmentsService.findOne).toHaveBeenCalledWith('att-001');
      expect(join).toHaveBeenCalledWith('./uploads', mockAttachmentRecord.objectKey);
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
      expect(res.setHeader).toHaveBeenCalledWith('Content-Disposition', 'attachment; filename="rapport-incident.pdf"');
      expect(res.setHeader).toHaveBeenCalledWith('Content-Length', 102400);
      expect(createReadStream).toHaveBeenCalledWith('/uploads/tickets/2026/01/uuid-rapport-incident.pdf');
      expect(mockStream.pipe).toHaveBeenCalledWith(res);
    });

    it('doit utiliser le chemin de stockage par defaut si STORAGE_LOCAL_PATH est absent', async () => {
      const originalPath = process.env['STORAGE_LOCAL_PATH'];
      delete process.env['STORAGE_LOCAL_PATH'];

      attachmentsService.findOne.mockResolvedValue(mockAttachmentRecord);
      (join as jest.Mock).mockReturnValue('./uploads/tickets/2026/01/uuid-rapport-incident.pdf');
      const mockStream = { pipe: jest.fn() } as any;
      (createReadStream as jest.Mock).mockReturnValue(mockStream);
      const res = makeMockResponse() as Response;

      await controller.download('att-001', res);

      expect(join).toHaveBeenCalledWith('./uploads', mockAttachmentRecord.objectKey);

      if (originalPath) {
        process.env['STORAGE_LOCAL_PATH'] = originalPath;
      }
    });

    it('doit propager les erreurs du service (not found)', async () => {
      attachmentsService.findOne.mockRejectedValue(new Error('Pièce jointe non trouvée.'));
      const res = makeMockResponse() as Response;

      await expect(controller.download('att-unknown', res)).rejects.toThrow('Pièce jointe non trouvée.');
    });

    it('doit utiliser le STORAGE_LOCAL_PATH personnalise', async () => {
      process.env['STORAGE_LOCAL_PATH'] = '/custom/storage';
      attachmentsService.findOne.mockResolvedValue(mockAttachmentRecord);
      (join as jest.Mock).mockReturnValue('/custom/storage/tickets/2026/01/uuid-rapport-incident.pdf');
      const mockStream = { pipe: jest.fn() } as any;
      (createReadStream as jest.Mock).mockReturnValue(mockStream);
      const res = makeMockResponse() as Response;

      await controller.download('att-001', res);

      expect(join).toHaveBeenCalledWith('/custom/storage', mockAttachmentRecord.objectKey);
    });
  });

  // =========================================================================
  // remove() — DELETE /attachments/:id
  // =========================================================================
  describe('DELETE /attachments/:id — Remove', () => {
    it('doit supprimer une piece jointe avec succes', async () => {
      attachmentsService.remove.mockResolvedValue(undefined);

      const result = await controller.remove('att-001');

      expect(attachmentsService.remove).toHaveBeenCalledWith('att-001');
      expect(result).toBeUndefined();
    });

    it('doit propager les erreurs du service', async () => {
      attachmentsService.remove.mockRejectedValue(new Error('Pièce jointe non trouvée.'));

      await expect(controller.remove('att-unknown')).rejects.toThrow('Pièce jointe non trouvée.');
    });

    it('doit etre idempotent si le service ne leve pas derreur', async () => {
      attachmentsService.remove.mockResolvedValue(undefined);

      await expect(controller.remove('att-001')).resolves.toBeUndefined();
      await expect(controller.remove('att-001')).resolves.toBeUndefined();
      expect(attachmentsService.remove).toHaveBeenCalledTimes(2);
    });
  });
});
