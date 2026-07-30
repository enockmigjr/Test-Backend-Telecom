/**
 * ============================================================================
 * FICHIER : src/database/schemas/ticket-comments.ts
 * RÔLE : Schéma de base de données PostgreSQL Drizzle ORM.
 * EXPLICATION :
 * Ce fichier décrit la structure d'une table PostgreSQL et ses contraintes.
 * 1. Définit les colonnes, types, clés primaires et relations.
 * 2. Assure un typage strict entre la base de données et le code TypeScript.
 * ============================================================================
 */

import { relations, sql } from 'drizzle-orm';
import { check, foreignKey, index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { actorTypeEnum } from './enums';
import { externalRequesters } from './external-requesters';
import { supportIntegrations } from './support-integrations';
import { tickets } from './tickets';
import { users } from './users';

/**
 * Commentaires publics visibles dans le suivi standard du ticket.
 */
/** Table PostgreSQL `ticketComments` : Définition des colonnes, contraintes et index. */
export const ticketComments = pgTable(
  'ticket_comments',
  {
    id: uuid('id').primaryKey(),
    ticketId: uuid('ticket_id')
      .notNull()
      .references(() => tickets.id),
    authorId: uuid('author_id').references(() => users.id),
    actorType: actorTypeEnum('actor_type').notNull().default('INTERNAL'),
    externalRequesterId: uuid('external_requester_id'),
    supportIntegrationId: uuid('support_integration_id').references(() => supportIntegrations.id, {
      onDelete: 'restrict',
    }),
    content: text('content').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    idxCommentsTicket: index('idx_comments_ticket').on(table.ticketId),
    idxCommentsRequester: index('idx_comments_requester').on(table.supportIntegrationId, table.externalRequesterId),
    integrationIdentityUnique: uniqueIndex('uq_ticket_comments_id_integration').on(
      table.id,
      table.supportIntegrationId,
    ),
    requesterIntegrationForeignKey: foreignKey({
      columns: [table.externalRequesterId, table.supportIntegrationId],
      foreignColumns: [externalRequesters.id, externalRequesters.supportIntegrationId],
      name: 'ticket_comments_requester_integration_fk',
    }).onDelete('restrict'),
    ticketIntegrationForeignKey: foreignKey({
      columns: [table.ticketId, table.supportIntegrationId],
      foreignColumns: [tickets.id, tickets.supportIntegrationId],
      name: 'ticket_comments_ticket_integration_fk',
    }).onDelete('restrict'),
    actorVariantCheck: check(
      'ticket_comments_actor_variant_check',
      sql`(${table.actorType} = 'INTERNAL' AND ${table.authorId} IS NOT NULL AND ${table.externalRequesterId} IS NULL)
        OR (${table.actorType} = 'EXTERNAL_REQUESTER' AND ${table.authorId} IS NULL
          AND ${table.externalRequesterId} IS NOT NULL AND ${table.supportIntegrationId} IS NOT NULL)
        OR (${table.actorType} = 'SYSTEM' AND ${table.authorId} IS NULL AND ${table.externalRequesterId} IS NULL)`,
    ),
  }),
);

/** Relations ORM `ticketCommentsRelations` : Définition des jointures et associations Drizzle. */
export const ticketCommentsRelations = relations(ticketComments, ({ one }) => ({
  ticket: one(tickets, {
    fields: [ticketComments.ticketId],
    references: [tickets.id],
  }),
  author: one(users, {
    fields: [ticketComments.authorId],
    references: [users.id],
  }),
  requester: one(externalRequesters, {
    fields: [ticketComments.externalRequesterId],
    references: [externalRequesters.id],
  }),
}));

export type TicketComment = typeof ticketComments.$inferSelect;
export type NewTicketComment = typeof ticketComments.$inferInsert;
