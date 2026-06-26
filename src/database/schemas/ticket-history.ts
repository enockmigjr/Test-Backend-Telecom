import { pgTable, uuid, varchar, jsonb, timestamp, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { tickets } from './tickets';
import { users } from './users';

/**
 * Historique complet des événements métier sur les tickets.
 * Chaque action importante (création, assignation, changement de statut...) crée un enregistrement.
 */
export const ticketHistory = pgTable(
  'ticket_history',
  {
    id: uuid('id').primaryKey(),
    ticketId: uuid('ticket_id')
      .notNull()
      .references(() => tickets.id),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    action: varchar('action', { length: 100 }).notNull(),
    oldValue: jsonb('old_value'),
    newValue: jsonb('new_value'),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    idxHistoryTicket: index('idx_history_ticket').on(table.ticketId),
    idxHistoryCreatedAt: index('idx_history_created_at').on(table.createdAt),
  }),
);

export const ticketHistoryRelations = relations(ticketHistory, ({ one }) => ({
  ticket: one(tickets, {
    fields: [ticketHistory.ticketId],
    references: [tickets.id],
  }),
  user: one(users, {
    fields: [ticketHistory.userId],
    references: [users.id],
  }),
}));

export type TicketHistory = typeof ticketHistory.$inferSelect;
export type NewTicketHistory = typeof ticketHistory.$inferInsert;
