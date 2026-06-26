import { pgTable, uuid, text, timestamp, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { tickets } from './tickets';
import { users } from './users';

/**
 * Commentaires publics visibles dans le suivi standard du ticket.
 */
export const ticketComments = pgTable(
  'ticket_comments',
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
    idxCommentsTicket: index('idx_comments_ticket').on(table.ticketId),
  }),
);

export const ticketCommentsRelations = relations(ticketComments, ({ one }) => ({
  ticket: one(tickets, {
    fields: [ticketComments.ticketId],
    references: [tickets.id],
  }),
  author: one(users, {
    fields: [ticketComments.authorId],
    references: [users.id],
  }),
}));

export type TicketComment = typeof ticketComments.$inferSelect;
export type NewTicketComment = typeof ticketComments.$inferInsert;
