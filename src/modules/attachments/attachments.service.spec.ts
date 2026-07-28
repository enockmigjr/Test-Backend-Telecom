import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TicketAccessService } from '../../common/services/ticket-access.service';
import { DrizzleProvider } from '../../database/drizzle.provider';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { AttachmentsService } from './attachments.service';
import { LocalStorageService } from './storage/local-storage.service';

const user: JwtPayload = {
  sub: 'agent-001',
  email: 'agent@telecom.local',
  role: 'CUSTOMER_SERVICE_AGENT',
  departmentId: 'dept-001',
  mustChangePassword: false,
  jti: 'jti-001',
};
const attachment = {
  id: 'attachment-001',
  ticketId: 'ticket-001',
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

function query<T>(rows: T[]): Record<string, jest.Mock> {
  const builder: Record<string, jest.Mock> = {};
  for (const method of ['from', 'where', 'limit']) builder[method] = jest.fn(() => builder);
  builder['then'] = jest.fn((resolve: (value: T[]) => void) => resolve(rows));
  return builder;
}

describe('AttachmentsService - controle parent', () => {
  const select = jest.fn();
  const storage = { upload: jest.fn(), delete: jest.fn() };
  const access = { resolveVisibleParent: jest.fn(), assertTicketVisible: jest.fn() };
  let service: AttachmentsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        AttachmentsService,
        { provide: DrizzleProvider, useValue: { db: { select } } },
        { provide: LocalStorageService, useValue: storage },
        { provide: TicketAccessService, useValue: access },
      ],
    }).compile();
    service = moduleRef.get(AttachmentsService);
  });

  it('refuse un upload sans fichier', async () => {
    await expect(service.upload(undefined, user, { ticketId: 'ticket-001' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(access.resolveVisibleParent).not.toHaveBeenCalled();
  });

  it('refuse le telechargement quand la ressource parente est hors scope', async () => {
    select.mockReturnValueOnce(query([attachment]));
    access.resolveVisibleParent.mockRejectedValue(new ForbiddenException());
    await expect(service.findOneForUser('attachment-001', user)).rejects.toBeInstanceOf(ForbiddenException);
    expect(access.resolveVisibleParent).toHaveBeenCalledWith(attachment, user);
  });

  it('verifie la visibilite parent avant toute suppression', async () => {
    select.mockReturnValueOnce(query([attachment]));
    access.resolveVisibleParent.mockRejectedValue(new ForbiddenException());
    await expect(service.remove('attachment-001', user)).rejects.toBeInstanceOf(ForbiddenException);
    expect(storage.delete).not.toHaveBeenCalled();
  });
});
