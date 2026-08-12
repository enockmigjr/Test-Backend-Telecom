import { BadRequestException } from '@nestjs/common';
import { PublicAttachmentUploadService } from './public-attachment-upload.service';
import { PublicTicketAccessService } from '../public-support/services/public-ticket-access.service';
import { LocalStorageService } from './storage/local-storage.service';

const INTEGRATION = {
  features: { attachments: true },
  quotaPolicy: { attachmentMaxBytes: 10 * 1024 * 1024, attachmentUploadsPerHour: 20 },
};

const PRINCIPAL = {
  kind: 'PUBLIC' as const,
  sub: 'requester-1',
  externalRequesterId: 'requester-1',
  supportIntegrationId: 'integration-1',
  jti: 'jti-1',
};

const FILE = {
  originalname: 'facture.pdf',
  size: 1024,
  buffer: Buffer.from('pdf'),
  path: undefined,
  mimetype: 'application/pdf',
  fieldname: 'file',
  encoding: '7bit',
} as unknown as Express.Multer.File;

const RESERVATION = {
  keyHash: 'hash',
  fingerprint: 'fp',
  expiresAt: new Date(Date.now() + 60_000),
};

function buildMocks(overrides: { quotaCount?: string } = {}) {
  const quotaCount = overrides.quotaCount ?? '0';
  const select = jest.fn();
  select.mockReturnValueOnce({
    from: jest.fn(() => ({
      where: jest.fn(() => ({ limit: jest.fn(() => Promise.resolve([INTEGRATION])) })),
    })),
  });
  select.mockReturnValue({
    from: jest.fn(() => ({ where: jest.fn(() => Promise.resolve([{ count: quotaCount }])) })),
  });
  const drizzle = {
    db: {
      select,
      insert: jest.fn(() => ({ values: jest.fn(() => Promise.resolve(undefined)) })),
    },
    runInTransaction: jest.fn(async (callback: () => Promise<void>) => callback()),
  };
  const access = {
    requireTicket: jest.fn().mockResolvedValue({ id: 'ticket-1' }),
    requireConversation: jest.fn().mockResolvedValue({ id: 'conversation-1', status: 'OPEN', ticketId: null }),
  };
  const storage = {
    quarantine: jest.fn().mockResolvedValue('quarantine/attachments/2026/08/file'),
    discardIncoming: jest.fn().mockResolvedValue(undefined),
    deleteQuarantine: jest.fn().mockResolvedValue(undefined),
  };
  const antivirus = { health: jest.fn().mockResolvedValue(true), scan: jest.fn() };
  const service = new PublicAttachmentUploadService(
    drizzle as never,
    storage as unknown as LocalStorageService,
    access as unknown as PublicTicketAccessService,
    antivirus as never,
  );
  return { service, drizzle, storage, access, antivirus };
}

describe('PublicAttachmentUploadService', () => {
  it('refuse un fichier absent', async () => {
    const { service } = buildMocks();
    await expect(
      service.upload({ kind: 'ticket', ticketId: 'ticket-1' }, PRINCIPAL, undefined, RESERVATION),
    ).rejects.toThrow(BadRequestException);
  });

  it('refuse si le quota horaire est atteint', async () => {
    const { service, storage } = buildMocks({ quotaCount: '20' });
    await expect(
      service.upload({ kind: 'ticket', ticketId: 'ticket-1' }, PRINCIPAL, FILE, RESERVATION),
    ).rejects.toThrow('Quota de pièces jointes atteint.');
    expect(storage.discardIncoming).toHaveBeenCalledWith(FILE);
  });

  it('quarantaine puis persiste attachment + outbox pour un ticket', async () => {
    const { service, drizzle, storage, access } = buildMocks();
    const result = await service.upload({ kind: 'ticket', ticketId: 'ticket-1' }, PRINCIPAL, FILE, RESERVATION);
    expect(result.data.scanStatus).toBe('QUARANTINED');
    expect(access.requireTicket).toHaveBeenCalledWith('ticket-1', PRINCIPAL);
    expect(storage.quarantine).toHaveBeenCalledWith(FILE, expect.stringMatching(/^attachments\/2026\/08\//));
    expect(drizzle.db.insert).toHaveBeenCalledTimes(2); // attachment + outbox
    expect(drizzle.runInTransaction).toHaveBeenCalledTimes(1);
  });

  it('persiste aussi le message de transport pour une conversation pré-ticket', async () => {
    const { service, drizzle, storage, access } = buildMocks();
    const result = await service.upload(
      { kind: 'conversation', conversationId: 'conversation-1' },
      PRINCIPAL,
      FILE,
      RESERVATION,
    );
    expect(result.data.scanStatus).toBe('QUARANTINED');
    expect(access.requireConversation).toHaveBeenCalledWith('conversation-1', PRINCIPAL);
    expect(storage.quarantine).toHaveBeenCalledWith(FILE, expect.stringMatching(/^attachments\/pre-ticket\//));
    expect(drizzle.db.insert).toHaveBeenCalledTimes(3); // support_message + attachment + outbox
  });

  it('refuse une conversation déjà finalisée', async () => {
    const { service, access, storage } = buildMocks();
    access.requireConversation.mockResolvedValue({ id: 'conversation-1', status: 'TICKET_CREATED', ticketId: 't' });
    await expect(
      service.upload({ kind: 'conversation', conversationId: 'conversation-1' }, PRINCIPAL, FILE, RESERVATION),
    ).rejects.toThrow('Conversation finalisée.');
    expect(storage.discardIncoming).toHaveBeenCalledWith(FILE);
  });
});
