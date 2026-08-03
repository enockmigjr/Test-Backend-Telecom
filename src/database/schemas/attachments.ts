/**
 * ============================================================================
 * FICHIER : src/database/schemas/attachments.ts
 * RÔLE : Schéma de base de données PostgreSQL Drizzle ORM.
 * EXPLICATION :
 * Ce fichier décrit la structure d'une table PostgreSQL et ses contraintes.
 * 1. Définit les colonnes, types, clés primaires et relations.
 * 2. Assure un typage strict entre la base de données et le code TypeScript.
 * ============================================================================
 */

import { relations, sql } from 'drizzle-orm';
import { bigint, check, foreignKey, index, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { actorTypeEnum, attachmentScanStatusEnum } from './enums';
import { externalRequesters } from './external-requesters';
import { supportIntegrations } from './support-integrations';
import { supportMessages } from './support-messages';
import { tickets } from './tickets';
import { ticketComments } from './ticket-comments';
import { ticketInternalNotes } from './ticket-internal-notes';
import { users } from './users';

/**
 * Métadonnées des pièces jointes.
 * Le stockage réel est délégué à un service de stockage abstrait.
 * Contrainte CHECK : au moins un des trois (ticket_id, comment_id, internal_note_id) doit être non-null.
 */
/** Table PostgreSQL `attachments` : Définition des colonnes, contraintes et index. */
export const attachments = pgTable(
  'attachments',
  {
    id: uuid('id').primaryKey(),
    ticketId: uuid('ticket_id').references(() => tickets.id),
    commentId: uuid('comment_id').references(() => ticketComments.id),
    internalNoteId: uuid('internal_note_id').references(() => ticketInternalNotes.id),
    supportMessageId: uuid('support_message_id'),
    uploadedBy: uuid('uploaded_by').references(() => users.id),
    actorType: actorTypeEnum('actor_type').notNull().default('INTERNAL'),
    externalRequesterId: uuid('external_requester_id'),
    supportIntegrationId: uuid('support_integration_id').references(() => supportIntegrations.id, {
      onDelete: 'restrict',
    }),
    objectKey: text('object_key').notNull(),
    bucketName: varchar('bucket_name', { length: 100 }).notNull().default('default'),
    originalFilename: varchar('original_filename', { length: 255 }).notNull(),
    mimeType: varchar('mime_type', { length: 100 }).notNull(),
    fileSize: bigint('file_size', { mode: 'number' }).notNull(),
    scanStatus: attachmentScanStatusEnum('scan_status').notNull().default('NOT_REQUIRED'),
    scannedAt: timestamp('scanned_at', { withTimezone: true }),
    quarantineDeletedAt: timestamp('quarantine_deleted_at', { withTimezone: true }),
    scanError: text('scan_error'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    idxAttachmentsTicket: index('idx_attachments_ticket').on(table.ticketId),
    idxAttachmentsUploadedBy: index('idx_attachments_uploaded_by').on(table.uploadedBy),
    idxAttachmentsRequester: index('idx_attachments_requester').on(
      table.supportIntegrationId,
      table.externalRequesterId,
    ),
    idxAttachmentsSupportMessage: index('idx_attachments_support_message').on(table.supportMessageId),
    requesterIntegrationForeignKey: foreignKey({
      columns: [table.externalRequesterId, table.supportIntegrationId],
      foreignColumns: [externalRequesters.id, externalRequesters.supportIntegrationId],
      name: 'attachments_requester_integration_fk',
    }).onDelete('restrict'),
    supportMessageIntegrationForeignKey: foreignKey({
      columns: [table.supportMessageId, table.supportIntegrationId],
      foreignColumns: [supportMessages.id, supportMessages.supportIntegrationId],
      name: 'attachments_support_message_integration_fk',
    }).onDelete('restrict'),
    ticketIntegrationForeignKey: foreignKey({
      columns: [table.ticketId, table.supportIntegrationId],
      foreignColumns: [tickets.id, tickets.supportIntegrationId],
      name: 'attachments_ticket_integration_fk',
    }).onDelete('restrict'),
    commentIntegrationForeignKey: foreignKey({
      columns: [table.commentId, table.supportIntegrationId],
      foreignColumns: [ticketComments.id, ticketComments.supportIntegrationId],
      name: 'attachments_comment_integration_fk',
    }).onDelete('restrict'),
    parentCheck: check(
      'attachments_parent_check',
      sql`num_nonnulls(${table.ticketId}, ${table.commentId}, ${table.internalNoteId}, ${table.supportMessageId}) = 1`,
    ),
    actorVariantCheck: check(
      'attachments_actor_variant_check',
      sql`(${table.actorType} = 'INTERNAL' AND ${table.uploadedBy} IS NOT NULL AND ${table.externalRequesterId} IS NULL)
        OR (${table.actorType} = 'EXTERNAL_REQUESTER' AND ${table.uploadedBy} IS NULL
          AND ${table.externalRequesterId} IS NOT NULL AND ${table.supportIntegrationId} IS NOT NULL)
        OR (${table.actorType} = 'SYSTEM' AND ${table.uploadedBy} IS NULL AND ${table.externalRequesterId} IS NULL)`,
    ),
    internalNoteActorCheck: check(
      'attachments_internal_note_actor_check',
      sql`${table.internalNoteId} IS NULL OR ${table.actorType} <> 'EXTERNAL_REQUESTER'`,
    ),
  }),
);

/** Relations ORM `attachmentsRelations` : Définition des jointures et associations Drizzle. */
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
  supportMessage: one(supportMessages, {
    fields: [attachments.supportMessageId],
    references: [supportMessages.id],
  }),
  uploader: one(users, {
    fields: [attachments.uploadedBy],
    references: [users.id],
  }),
}));

export type Attachment = typeof attachments.$inferSelect;
export type NewAttachment = typeof attachments.$inferInsert;
