import { pgTable, uuid, text, timestamp, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { tickets } from './tickets';
import { users } from './users';

/**
 * Notes internes réservées aux équipes internes.
 * Jamais exposées aux utilisateurs externes.
 */
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
