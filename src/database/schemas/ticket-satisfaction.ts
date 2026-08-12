/**
 * ============================================================================
 * FICHIER : src/database/schemas/ticket-satisfaction.ts
 * ROLE : Notes de satisfaction des demandeurs sur les tickets publics.
 * EXPLICATION :
 * Un jeton opaque (hashé en base) est généré à la clôture d'un ticket public ;
 * le demandeur peut noter 1-5 une seule fois avant expiration.
 * ============================================================================
 */

import { check, index, pgTable, smallint, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tickets } from './tickets';
import { supportIntegrations } from './support-integrations';

export const ticketSatisfaction = pgTable(
  'ticket_satisfaction',
  {
    id: uuid('id').primaryKey(),
    ticketId: uuid('ticket_id')
      .notNull()
      .references(() => tickets.id, { onDelete: 'restrict' }),
    supportIntegrationId: uuid('support_integration_id').references(() => supportIntegrations.id, {
      onDelete: 'restrict',
    }),
    note: smallint('note'),
    comment: text('comment'),
    tokenHash: text('token_hash').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    ticketIndex: index('idx_ticket_satisfaction_ticket').on(table.ticketId),
    noteCheck: check('ticket_satisfaction_note_check', sql`${table.note} BETWEEN 1 AND 5`),
  }),
);

export type TicketSatisfaction = typeof ticketSatisfaction.$inferSelect;
export type NewTicketSatisfaction = typeof ticketSatisfaction.$inferInsert;
