/**
 * ============================================================================
 * FICHIER : src/database/schemas/idempotency-records.ts
 * RÔLE : Schéma de base de données PostgreSQL Drizzle ORM.
 * EXPLICATION :
 * Ce fichier décrit la structure d'une table PostgreSQL et ses contraintes.
 * 1. Définit les colonnes, types, clés primaires et relations.
 * 2. Assure un typage strict entre la base de données et le code TypeScript.
 * ============================================================================
 */

import { index, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from './users';

/** Table PostgreSQL `idempotencyRecords` : Définition des colonnes, contraintes et index. */
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
