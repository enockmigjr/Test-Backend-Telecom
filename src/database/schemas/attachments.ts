import { pgTable, uuid, text, varchar, bigint, timestamp, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { tickets } from './tickets';
import { ticketComments } from './ticket-comments';
import { ticketInternalNotes } from './ticket-internal-notes';
import { users } from './users';

/**
 * Métadonnées des pièces jointes.
 * Le stockage réel est délégué à un service de stockage abstrait.
 * Contrainte CHECK : au moins un des trois (ticket_id, comment_id, internal_note_id) doit être non-null.
 */
export const attachments = pgTable(
  'attachments',
  {
    id: uuid('id').primaryKey(),
    ticketId: uuid('ticket_id').references(() => tickets.id),
    commentId: uuid('comment_id').references(() => ticketComments.id),
    internalNoteId: uuid('internal_note_id').references(() => ticketInternalNotes.id),
    uploadedBy: uuid('uploaded_by')
      .notNull()
      .references(() => users.id),
    objectKey: text('object_key').notNull(),
    bucketName: varchar('bucket_name', { length: 100 }).notNull().default('default'),
    originalFilename: varchar('original_filename', { length: 255 }).notNull(),
    mimeType: varchar('mime_type', { length: 100 }).notNull(),
    fileSize: bigint('file_size', { mode: 'number' }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    idxAttachmentsTicket: index('idx_attachments_ticket').on(table.ticketId),
    idxAttachmentsUploadedBy: index('idx_attachments_uploaded_by').on(table.uploadedBy),
  }),
);

export const attachmentsRelations = relations(attachments, ({ one }) => ({
  ticket: one(tickets, {
    fields: [attachments.ticketId],
    references: [tickets.id],
  }),
  comment: one(ticketComments, {
    fields: [attachments.commentId],
    references: [ticketComments.id],
  }),
  internalNote: one(ticketInternalNotes, {
    fields: [attachments.internalNoteId],
    references: [ticketInternalNotes.id],
  }),
  uploader: one(users, {
    fields: [attachments.uploadedBy],
    references: [users.id],
  }),
}));

export type Attachment = typeof attachments.$inferSelect;
export type NewAttachment = typeof attachments.$inferInsert;
