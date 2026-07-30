import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { deliveryStatusEnum, supportChannelEnum } from './enums';
import { outboxEvents } from './outbox-events';
import { supportIntegrations } from './support-integrations';

/** État observable d'une livraison externe at-least-once. */
export const externalDeliveries = pgTable(
  'external_deliveries',
  {
    id: uuid('id').primaryKey(),
    outboxEventId: uuid('outbox_event_id')
      .notNull()
      .references(() => outboxEvents.id, { onDelete: 'restrict' }),
    supportIntegrationId: uuid('support_integration_id')
      .notNull()
      .references(() => supportIntegrations.id, { onDelete: 'restrict' }),
    channel: supportChannelEnum('channel').notNull(),
    destinationKey: varchar('destination_key', { length: 180 }).notNull(),
    status: deliveryStatusEnum('status').notNull().default('PENDING'),
    attemptCount: integer('attempt_count').notNull().default(0),
    providerMessageId: varchar('provider_message_id', { length: 255 }),
    lockedAt: timestamp('locked_at', { withTimezone: true }),
    lockedBy: varchar('locked_by', { length: 120 }),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    lastError: text('last_error'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    deliveryUnique: uniqueIndex('uq_external_deliveries_target').on(
      table.outboxEventId,
      table.channel,
      table.destinationKey,
    ),
    claimIndex: index('idx_external_deliveries_claim').on(table.status, table.createdAt),
    integrationIndex: index('idx_external_deliveries_integration').on(table.supportIntegrationId, table.createdAt),
    outboxIntegrationForeignKey: foreignKey({
      columns: [table.outboxEventId, table.supportIntegrationId],
      foreignColumns: [outboxEvents.id, outboxEvents.supportIntegrationId],
      name: 'external_deliveries_outbox_integration_fk',
    }).onDelete('restrict'),
    attemptsCheck: check('external_deliveries_attempts_check', sql`${table.attemptCount} >= 0`),
  }),
);

export type ExternalDelivery = typeof externalDeliveries.$inferSelect;
export type NewExternalDelivery = typeof externalDeliveries.$inferInsert;
