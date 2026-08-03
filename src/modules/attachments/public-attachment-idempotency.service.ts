import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { createReadStream } from 'fs';
import { and, eq, lte } from 'drizzle-orm';
import { DrizzleProvider } from '../../database/drizzle.provider';
import { attachments } from '../../database/schemas';
import { PublicPrincipal } from '../external-identity/interfaces/public-principal.interface';
import { LocalStorageService } from './storage/local-storage.service';

const KEY_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;
const TTL_MS = 24 * 60 * 60_000;

export interface PublicUploadReservation {
  readonly keyHash: string;
  readonly fingerprint: string;
  readonly expiresAt: Date;
}

export interface PublicAttachmentUploadResponse {
  readonly data: {
    readonly id: string;
    readonly filename: string;
    readonly fileSize: number;
    readonly scanStatus: string;
  };
}

@Injectable()
export class PublicAttachmentIdempotencyService {
  constructor(
    private readonly drizzle: DrizzleProvider,
    private readonly storage: LocalStorageService,
  ) {}

  async execute(
    key: string | undefined,
    scope: string,
    principal: PublicPrincipal,
    file: Express.Multer.File | undefined,
    operation: (reservation: PublicUploadReservation) => Promise<PublicAttachmentUploadResponse>,
  ): Promise<PublicAttachmentUploadResponse> {
    if (!file) throw new BadRequestException('Aucun fichier fourni.');
    if (!key || !KEY_PATTERN.test(key)) {
      await this.storage.discardIncoming(file);
      throw new BadRequestException('Le header Idempotency-Key est requis et doit être valide.');
    }
    let fingerprint: string;
    try {
      fingerprint = await fileFingerprint(file);
    } catch (error: unknown) {
      await this.storage.discardIncoming(file);
      throw error;
    }
    const keyHash = digest(
      `EXTERNAL_REQUESTER:${principal.supportIntegrationId}:${principal.externalRequesterId}:POST:${scope}:${key}`,
    );
    const now = new Date();
    await this.drizzle.db
      .update(attachments)
      .set({ publicUploadKeyHash: null, publicUploadFingerprint: null, publicUploadIdempotencyExpiresAt: null })
      .where(and(eq(attachments.publicUploadKeyHash, keyHash), lte(attachments.publicUploadIdempotencyExpiresAt, now)));
    const existing = await this.find(keyHash);
    if (existing) return this.replay(existing, fingerprint, file);
    const reservation = { keyHash, fingerprint, expiresAt: new Date(now.getTime() + TTL_MS) };
    try {
      return await operation(reservation);
    } catch (error: unknown) {
      if (!isUniqueViolation(error)) throw error;
      const concurrent = await this.find(keyHash);
      if (!concurrent) throw error;
      return this.replay(concurrent, fingerprint, file);
    }
  }

  private async find(keyHash: string) {
    const [record] = await this.drizzle.db
      .select({
        id: attachments.id,
        filename: attachments.originalFilename,
        fileSize: attachments.fileSize,
        scanStatus: attachments.scanStatus,
        fingerprint: attachments.publicUploadFingerprint,
      })
      .from(attachments)
      .where(eq(attachments.publicUploadKeyHash, keyHash))
      .limit(1);
    return record;
  }

  private async replay(
    record: { id: string; filename: string; fileSize: number; scanStatus: string; fingerprint: string | null },
    fingerprint: string,
    file: Express.Multer.File,
  ): Promise<PublicAttachmentUploadResponse> {
    await this.storage.discardIncoming(file);
    if (record.fingerprint !== fingerprint) throw new ConflictException('Cette clé concerne un autre fichier.');
    return {
      data: {
        id: record.id,
        filename: record.filename,
        fileSize: record.fileSize,
        scanStatus: record.scanStatus,
      },
    };
  }
}

async function fileFingerprint(file: Express.Multer.File): Promise<string> {
  const hash = createHash('sha256').update(file.originalname).update('\0').update(String(file.size)).update('\0');
  if (file.path) {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- chemin produit par Multer dans incoming
    for await (const chunk of createReadStream(file.path)) hash.update(chunk);
  } else hash.update(file.buffer);
  return hash.digest('hex');
}

function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
}
