import { BadRequestException, ConflictException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { createHash } from 'crypto';
import { Readable } from 'stream';
import { DrizzleProvider } from '../../database/drizzle.provider';
import { PublicPrincipal } from '../external-identity/interfaces/public-principal.interface';
import { PublicAttachmentIdempotencyService, PublicUploadReservation } from './public-attachment-idempotency.service';
import { LocalStorageService } from './storage/local-storage.service';

interface StoredAttachment {
  readonly id: string;
  readonly filename: string;
  readonly fileSize: number;
  readonly scanStatus: string;
  readonly fingerprint: string | null;
}

const principal: PublicPrincipal = {
  kind: 'PUBLIC',
  sub: 'requester-001',
  externalRequesterId: 'requester-001',
  supportIntegrationId: 'integration-001',
  jti: 'session-001',
};
const response = { data: { id: 'attachment-001', filename: 'preuve.pdf', fileSize: 4, scanStatus: 'QUARANTINED' } };

describe('PublicAttachmentIdempotencyService', () => {
  let service: PublicAttachmentIdempotencyService;
  const limit = jest.fn<Promise<StoredAttachment[]>, [number]>();
  const updateWhere = jest.fn<Promise<void>, [object]>();
  const updateSet = jest.fn(() => ({ where: updateWhere }));
  const discardIncoming = jest.fn<Promise<void>, [Express.Multer.File]>();

  beforeEach(async () => {
    jest.clearAllMocks();
    limit.mockResolvedValue([]);
    updateWhere.mockResolvedValue(undefined);
    discardIncoming.mockResolvedValue(undefined);
    const db = {
      update: jest.fn(() => ({ set: updateSet })),
      select: jest.fn(() => ({ from: jest.fn(() => ({ where: jest.fn(() => ({ limit })) })) })),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        PublicAttachmentIdempotencyService,
        { provide: DrizzleProvider, useValue: { db } },
        { provide: LocalStorageService, useValue: { discardIncoming } },
      ],
    }).compile();
    service = moduleRef.get(PublicAttachmentIdempotencyService);
  });

  it.each([undefined, '', 'cle invalide'])('nettoie le fichier si la clé est absente ou invalide', async (key) => {
    const file = makeFile('data');
    const operation = jest.fn();
    await expect(service.execute(key, 'tickets/1/attachments', principal, file, operation)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(discardIncoming).toHaveBeenCalledWith(file);
    expect(operation).not.toHaveBeenCalled();
  });

  it('refuse une même clé lorsque les octets réels diffèrent', async () => {
    const file = makeFile('BBBB');
    limit.mockResolvedValueOnce([stored(fingerprint(makeFile('AAAA')))]);
    await expect(
      service.execute('upload-1', 'tickets/1/attachments', principal, file, async () => response),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(discardIncoming).toHaveBeenCalledWith(file);
  });

  it('rejoue la pièce persistée pour le même fichier', async () => {
    const file = makeFile('same');
    limit.mockResolvedValueOnce([stored(fingerprint(file))]);
    const operation = jest.fn();
    await expect(service.execute('upload-2', 'tickets/1/attachments', principal, file, operation)).resolves.toEqual(
      response,
    );
    expect(discardIncoming).toHaveBeenCalledWith(file);
    expect(operation).not.toHaveBeenCalled();
  });

  it('transmet une réservation atomique avec expiration à la création métier', async () => {
    const file = makeFile('data');
    let reservation: PublicUploadReservation | undefined;
    await service.execute('upload-3', 'tickets/1/attachments', principal, file, async (value) => {
      reservation = value;
      return response;
    });
    expect(reservation).toEqual(expect.objectContaining({ fingerprint: fingerprint(file) }));
    expect(reservation?.expiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(updateSet).toHaveBeenCalledWith({
      publicUploadKeyHash: null,
      publicUploadFingerprint: null,
      publicUploadIdempotencyExpiresAt: null,
    });
  });

  it('résout une concurrence via la contrainte unique de la pièce jointe', async () => {
    const file = makeFile('same');
    limit.mockResolvedValueOnce([]).mockResolvedValueOnce([stored(fingerprint(file))]);
    const duplicate = Object.assign(new Error('duplicate'), { code: '23505' });
    await expect(
      service.execute('upload-4', 'tickets/1/attachments', principal, file, async () => {
        throw duplicate;
      }),
    ).resolves.toEqual(response);
    expect(discardIncoming).toHaveBeenCalledWith(file);
  });

  it('propage une erreur métier sans créer de réservation séparée bloquante', async () => {
    const failure = new Error('quarantine failure');
    await expect(
      service.execute('upload-5', 'tickets/1/attachments', principal, makeFile('data'), async () => {
        throw failure;
      }),
    ).rejects.toBe(failure);
  });
});

function makeFile(content: string): Express.Multer.File {
  const buffer = Buffer.from(content);
  return {
    fieldname: 'file',
    originalname: 'preuve.pdf',
    encoding: '7bit',
    mimetype: 'application/pdf',
    size: buffer.length,
    buffer,
    destination: '',
    filename: '',
    path: '',
    stream: Readable.from(buffer),
  };
}

function fingerprint(file: Express.Multer.File): string {
  return createHash('sha256')
    .update(file.originalname)
    .update('\0')
    .update(String(file.size))
    .update('\0')
    .update(file.buffer)
    .digest('hex');
}

function stored(fileFingerprint: string): StoredAttachment {
  return {
    id: response.data.id,
    filename: response.data.filename,
    fileSize: response.data.fileSize,
    scanStatus: response.data.scanStatus,
    fingerprint: fileFingerprint,
  };
}
