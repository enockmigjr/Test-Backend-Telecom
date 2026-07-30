import { sql } from 'drizzle-orm';
import { check, foreignKey, index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { actorTypeEnum, supportMessageDirectionEnum } from './enums';
import { externalRequesters } from './external-requesters';
import { supportIntegrations } from './support-integrations';
import { supportConversations } from './support-conversations';
import { ticketComments } from './ticket-comments';
import { users } from './users';

/** Message de transport canonique avant ticket, puis simple lien vers le commentaire métier. */
export const supportMessages = pgTable(
  'support_messages',
  {
    id: uuid('id').primaryKey(),
    supportIntegrationId: uuid('support_integration_id')
      .notNull()
      .references(() => supportIntegrations.id, { onDelete: 'restrict' }),
    conversationId: uuid('conversation_id').notNull(),
    ticketCommentId: uuid('ticket_comment_id'),
    actorType: actorTypeEnum('actor_type').notNull(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'restrict' }),
    externalRequesterId: uuid('external_requester_id'),
    direction: supportMessageDirectionEnum('direction').notNull(),
    content: text('content'),
    channelMetadata: jsonb('channel_metadata').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    conversationIndex: index('idx_support_messages_conversation').on(table.conversationId, table.createdAt),
    requesterIndex: index('idx_support_messages_requester').on(table.supportIntegrationId, table.externalRequesterId),
    integrationIdentityUnique: uniqueIndex('uq_support_messages_id_integration').on(
      table.id,
      table.supportIntegrationId,
    ),
    conversationIntegrationForeignKey: foreignKey({
      columns: [table.conversationId, table.supportIntegrationId],
      foreignColumns: [supportConversations.id, supportConversations.supportIntegrationId],
      name: 'support_messages_conversation_integration_fk',
    }).onDelete('cascade'),
    requesterIntegrationForeignKey: foreignKey({
      columns: [table.externalRequesterId, table.supportIntegrationId],
      foreignColumns: [externalRequesters.id, externalRequesters.supportIntegrationId],
      name: 'support_messages_requester_integration_fk',
    }).onDelete('restrict'),
    commentIntegrationForeignKey: foreignKey({
      columns: [table.ticketCommentId, table.supportIntegrationId],
      foreignColumns: [ticketComments.id, ticketComments.supportIntegrationId],
      name: 'support_messages_comment_integration_fk',
    }).onDelete('restrict'),
    actorVariantCheck: check(
      'support_messages_actor_variant_check',
      sql`(${table.actorType} = 'INTERNAL' AND ${table.userId} IS NOT NULL AND ${table.externalRequesterId} IS NULL)
        OR (${table.actorType} = 'EXTERNAL_REQUESTER' AND ${table.userId} IS NULL AND ${table.externalRequesterId} IS NOT NULL)
        OR (${table.actorType} = 'SYSTEM' AND ${table.userId} IS NULL AND ${table.externalRequesterId} IS NULL)`,
    ),
    canonicalContentCheck: check(
      'support_messages_canonical_content_check',
      sql`num_nonnulls(${table.content}, ${table.ticketCommentId}) = 1`,
    ),
  }),
);

export type SupportMessage = typeof supportMessages.$inferSelect;
export type NewSupportMessage = typeof supportMessages.$inferInsert;
