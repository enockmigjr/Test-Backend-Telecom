/**
 * ============================================================================
 * FICHIER : src/database/schemas/ticket-internal-notes.ts
 * RÔLE : Schéma de base de données PostgreSQL Drizzle ORM.
 * EXPLICATION :
 * Ce fichier décrit la structure d'une table PostgreSQL et ses contraintes.
 * 1. Définit les colonnes, types, clés primaires et relations.
 * 2. Assure un typage strict entre la base de données et le code TypeScript.
 * ============================================================================
 */

import { pgTable, uuid, text, timestamp, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { tickets } from './tickets';
import { users } from './users';

/**
 * Notes internes réservées aux équipes internes.
 * Jamais exposées aux utilisateurs externes.
 */
/** Table PostgreSQL `ticketInternalNotes` : Définition des colonnes, contraintes et index. */
export const ticketInternalNotes = pgTable(
  'ticket_internal_notes',
  {
    id: uuid('id').primaryKey(),
    ticketId: uuid('ticket_id')
      .notNull()
      .references(() => tickets.id),
    authorId: uuid('author_id')
      .notNull()
      .references(() => users.id),
    content: text('content').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    idxInternalNotesTicket: index('idx_internal_notes_ticket').on(table.ticketId),
  }),
);

/** Relations ORM `ticketInternalNotesRelations` : Définition des jointures et associations Drizzle. */
export const ticketInternalNotesRelations = relations(ticketInternalNotes, ({ one }) => ({
  ticket: one(tickets, {
    fields: [ticketInternalNotes.ticketId],
    references: [tickets.id],
  }),
  author: one(users, {
    fields: [ticketInternalNotes.authorId],
    references: [users.id],
  }),
}));

export type TicketInternalNote = typeof ticketInternalNotes.$inferSelect;
export type NewTicketInternalNote = typeof ticketInternalNotes.$inferInsert;
