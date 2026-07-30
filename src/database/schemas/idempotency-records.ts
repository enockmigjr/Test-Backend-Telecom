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

import { sql } from 'drizzle-orm';
import { check, foreignKey, index, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { idempotencySubjectTypeEnum } from './enums';
import { externalRequesters } from './external-requesters';
import { supportIntegrations } from './support-integrations';
import { users } from './users';

/** Table PostgreSQL `idempotencyRecords` : Définition des colonnes, contraintes et index. */
export const idempotencyRecords = pgTable(
  'idempotency_records',
  {
    keyHash: text('key_hash').primaryKey(),
    userId: uuid('user_id').references(() => users.id),
    subjectType: idempotencySubjectTypeEnum('subject_type').notNull().default('INTERNAL'),
    externalRequesterId: uuid('external_requester_id'),
    supportIntegrationId: uuid('support_integration_id').references(() => supportIntegrations.id, {
      onDelete: 'restrict',
    }),
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
    requesterIndex: index('idx_idempotency_records_requester').on(
      table.supportIntegrationId,
      table.externalRequesterId,
    ),
    requesterIntegrationForeignKey: foreignKey({
      columns: [table.externalRequesterId, table.supportIntegrationId],
      foreignColumns: [externalRequesters.id, externalRequesters.supportIntegrationId],
      name: 'idempotency_records_requester_integration_fk',
    }).onDelete('restrict'),
    subjectVariantCheck: check(
      'idempotency_records_subject_variant_check',
      sql`(${table.subjectType} = 'INTERNAL' AND ${table.userId} IS NOT NULL
          AND ${table.externalRequesterId} IS NULL AND ${table.supportIntegrationId} IS NULL)
        OR (${table.subjectType} = 'EXTERNAL_REQUESTER' AND ${table.userId} IS NULL
          AND ${table.externalRequesterId} IS NOT NULL AND ${table.supportIntegrationId} IS NOT NULL)
        OR (${table.subjectType} = 'INTEGRATION' AND ${table.userId} IS NULL
          AND ${table.externalRequesterId} IS NULL AND ${table.supportIntegrationId} IS NOT NULL)`,
    ),
  }),
);

export type IdempotencyRecord = typeof idempotencyRecords.$inferSelect;
