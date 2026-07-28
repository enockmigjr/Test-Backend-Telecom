import { index, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from './users';

export const idempotencyRecords = pgTable(
  'idempotency_records',
  {
    keyHash: text('key_hash').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    method: text('method').notNull(),
    path: text('path').notNull(),
    fingerprint: text('fingerprint').notNull(),
    statusCode: integer('status_code'),
    responseBody: jsonb('response_body'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (table) => ({
    expiresAtIndex: index('idx_idempotency_records_expires_at').on(table.expiresAt),
    userIndex: index('idx_idempotency_records_user_id').on(table.userId),
  }),
);

export type IdempotencyRecord = typeof idempotencyRecords.$inferSelect;
