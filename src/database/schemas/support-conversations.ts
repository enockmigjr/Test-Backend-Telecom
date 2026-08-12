import { sql } from 'drizzle-orm';
import { check, foreignKey, index, jsonb, pgTable, timestamp, unique, uuid, varchar } from 'drizzle-orm/pg-core';
import { conversationStatusEnum, supportChannelEnum } from './enums';
import { externalRequesters } from './external-requesters';
import { supportIntegrations } from './support-integrations';
import { tickets } from './tickets';

/** Conversation persistée avant et après la création éventuelle d'un ticket. */
export const supportConversations = pgTable(
  'support_conversations',
  {
    id: uuid('id').primaryKey(),
    supportIntegrationId: uuid('support_integration_id')
      .notNull()
      .references(() => supportIntegrations.id, { onDelete: 'restrict' }),
    externalRequesterId: uuid('external_requester_id'),
    ticketId: uuid('ticket_id'),
    sourceChannel: supportChannelEnum('source_channel').notNull(),
    status: conversationStatusEnum('status').notNull().default('OPEN'),
    currentState: varchar('current_state', { length: 80 }).notNull().default('START'),
    context: jsonb('context').$type<Record<string, unknown>>().notNull().default({}),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    lastMessageAt: timestamp('last_message_at', { withTimezone: true }),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    integrationSubjectIndex: index('idx_support_conversations_integration_subject').on(
      table.supportIntegrationId,
      table.externalRequesterId,
    ),
    ticketIndex: index('idx_support_conversations_ticket').on(table.ticketId),
    integrationIdentityUnique: unique('uq_support_conversations_id_integration').on(
      table.id,
      table.supportIntegrationId,
    ),
    requesterIntegrationForeignKey: foreignKey({
      columns: [table.externalRequesterId, table.supportIntegrationId],
      foreignColumns: [externalRequesters.id, externalRequesters.supportIntegrationId],
      name: 'support_conversations_requester_integration_fk',
    }).onDelete('restrict'),
    ticketIntegrationForeignKey: foreignKey({
      columns: [table.ticketId, table.supportIntegrationId],
      foreignColumns: [tickets.id, tickets.supportIntegrationId],
      name: 'support_conversations_ticket_integration_fk',
    }).onDelete('restrict'),
    ticketCreatedStateCheck: check(
      'support_conversations_ticket_created_state_check',
      sql`${table.status} <> 'TICKET_CREATED' OR ${table.ticketId} IS NOT NULL`,
    ),
  }),
);

export type SupportConversation = typeof supportConversations.$inferSelect;
export type NewSupportConversation = typeof supportConversations.$inferInsert;
