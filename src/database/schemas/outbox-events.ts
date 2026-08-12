import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { actorTypeEnum, outboxStatusEnum } from './enums';
import { externalRequesters } from './external-requesters';
import { supportIntegrations } from './support-integrations';
import { users } from './users';

/** Événement durable écrit dans la même transaction que la mutation métier. */
export const outboxEvents = pgTable(
  'outbox_events',
  {
    id: uuid('id').primaryKey(),
    mutationId: uuid('mutation_id').notNull(),
    schemaVersion: integer('schema_version').notNull().default(1),
    supportIntegrationId: uuid('support_integration_id').references(() => supportIntegrations.id, {
      onDelete: 'restrict',
    }),
    actorType: actorTypeEnum('actor_type').notNull(),
    userId: uuid('user_id').references(() => users.id),
    externalRequesterId: uuid('external_requester_id'),
    aggregateType: varchar('aggregate_type', { length: 80 }).notNull(),
    aggregateId: uuid('aggregate_id').notNull(),
    eventType: varchar('event_type', { length: 120 }).notNull(),
    deduplicationKey: varchar('deduplication_key', { length: 180 }).notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    status: outboxStatusEnum('status').notNull().default('PENDING'),
    attemptCount: integer('attempt_count').notNull().default(0),
    maxAttempts: integer('max_attempts').notNull().default(10),
    availableAt: timestamp('available_at', { withTimezone: true }).notNull().defaultNow(),
    lockedAt: timestamp('locked_at', { withTimezone: true }),
    lockedBy: varchar('locked_by', { length: 120 }),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    failedAt: timestamp('failed_at', { withTimezone: true }),
    lastError: text('last_error'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    deduplicationUnique: uniqueIndex('uq_outbox_events_deduplication_key').on(table.deduplicationKey),
    integrationIdentityUnique: unique('uq_outbox_events_id_integration').on(table.id, table.supportIntegrationId),
    mutationEventUnique: uniqueIndex('uq_outbox_events_mutation_event_version').on(
      table.mutationId,
      table.eventType,
      table.schemaVersion,
    ),
    claimIndex: index('idx_outbox_events_claim').on(table.status, table.availableAt),
    aggregateIndex: index('idx_outbox_events_aggregate').on(table.aggregateType, table.aggregateId),
    integrationIndex: index('idx_outbox_events_integration').on(table.supportIntegrationId, table.createdAt),
    requesterIntegrationForeignKey: foreignKey({
      columns: [table.externalRequesterId, table.supportIntegrationId],
      foreignColumns: [externalRequesters.id, externalRequesters.supportIntegrationId],
      name: 'outbox_events_requester_integration_fk',
    }).onDelete('restrict'),
    actorVariantCheck: check(
      'outbox_events_actor_variant_check',
      sql`(${table.actorType} = 'INTERNAL' AND ${table.userId} IS NOT NULL AND ${table.externalRequesterId} IS NULL)
        OR (${table.actorType} = 'EXTERNAL_REQUESTER' AND ${table.userId} IS NULL
          AND ${table.externalRequesterId} IS NOT NULL AND ${table.supportIntegrationId} IS NOT NULL)
        OR (${table.actorType} = 'SYSTEM' AND ${table.userId} IS NULL AND ${table.externalRequesterId} IS NULL)`,
    ),
    schemaVersionCheck: check('outbox_events_schema_version_check', sql`${table.schemaVersion} > 0`),
    attemptsCheck: check(
      'outbox_events_attempts_check',
      sql`${table.attemptCount} >= 0 AND ${table.maxAttempts} > 0 AND ${table.attemptCount} <= ${table.maxAttempts}`,
    ),
  }),
);

export type OutboxEvent = typeof outboxEvents.$inferSelect;
export type NewOutboxEvent = typeof outboxEvents.$inferInsert;
