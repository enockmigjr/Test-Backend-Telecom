import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { generateUuid } from '../../common/helpers/uuidv7.helper';
import { DrizzleProvider } from '../../database/drizzle.provider';
import { attachments } from '../../database/schemas';
import { LocalStorageService } from './storage/local-storage.service';

@Injectable()
export class AttachmentsService {
  private readonly logger = new Logger(AttachmentsService.name);

  constructor(
    private readonly drizzle: DrizzleProvider,
    private readonly storage: LocalStorageService,
  ) {}

  async upload(
    file: Express.Multer.File,
    uploadedBy: string,
    ticketId?: string,
    commentId?: string,
    internalNoteId?: string,
  ) {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const objectKey = `tickets/${year}/${month}/${generateUuid()}-${file.originalname}`;

    await this.storage.upload(file, objectKey);

    const id = generateUuid();
    await this.drizzle.db.insert(attachments).values({
      id,
      ticketId: ticketId || null,
      commentId: commentId || null,
      internalNoteId: internalNoteId || null,
      uploadedBy,
      objectKey,
      bucketName: 'default',
      originalFilename: file.originalname,
      mimeType: file.mimetype,
      fileSize: file.size,
    });

    const [created] = await this.drizzle.db.select().from(attachments).where(eq(attachments.id, id)).limit(1);
    return { message: 'Fichier uploadé avec succès.', data: created };
  }

  async findOne(id: string) {
    const [att] = await this.drizzle.db.select().from(attachments).where(eq(attachments.id, id)).limit(1);
    if (!att) throw new NotFoundException('Pièce jointe non trouvée.');
    return att;
  }

  async download(id: string) {
    const att = await this.findOne(id);
    return this.storage.download(att.objectKey);
  }

  async remove(id: string) {
    const att = await this.findOne(id);
    await this.storage.delete(att.objectKey);
    await this.drizzle.db.delete(attachments).where(eq(attachments.id, id));
  }
}
