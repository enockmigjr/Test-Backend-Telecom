import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { generateUuid } from '../../common/helpers/uuidv7.helper';
import { DrizzleProvider } from '../../database/drizzle.provider';
import { attachments, tickets, ticketComments, ticketInternalNotes } from '../../database/schemas';
import { LocalStorageService } from './storage/local-storage.service';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

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

  async remove(id: string, user: JwtPayload) {
    const att = await this.findOne(id);

    if (att.uploadedBy !== user.sub) {
      if (user.role === 'SUPERVISOR') {
        let ticketId = att.ticketId;
        if (!ticketId && att.commentId) {
          const [comment] = await this.drizzle.db
            .select({ ticketId: ticketComments.ticketId })
            .from(ticketComments)
            .where(eq(ticketComments.id, att.commentId))
            .limit(1);
          ticketId = comment?.ticketId ?? null;
        } else if (!ticketId && att.internalNoteId) {
          const [note] = await this.drizzle.db
            .select({ ticketId: ticketInternalNotes.ticketId })
            .from(ticketInternalNotes)
            .where(eq(ticketInternalNotes.id, att.internalNoteId))
            .limit(1);
          ticketId = note?.ticketId ?? null;
        }

        if (!ticketId) {
          throw new ForbiddenException('Impossible de verifier la portee de cette piece jointe.');
        }

        const [ticket] = await this.drizzle.db
          .select({ assignedTeamId: tickets.assignedTeamId })
          .from(tickets)
          .where(eq(tickets.id, ticketId))
          .limit(1);

        if (!ticket || ticket.assignedTeamId !== user.departmentId) {
          throw new ForbiddenException(
            "Vous n'avez pas le droit de supprimer une piece jointe liee a un ticket hors de votre departement.",
          );
        }
      } else if (user.role !== 'ADMINISTRATOR') {
        throw new ForbiddenException("Vous n'avez pas le droit de supprimer cette pièce jointe.");
      }
    }

    await this.storage.delete(att.objectKey);
    await this.drizzle.db.delete(attachments).where(eq(attachments.id, id));
  }
}
