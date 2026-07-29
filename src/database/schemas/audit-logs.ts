/**
 * ============================================================================
 * FICHIER : src/database/schemas/audit-logs.ts
 * RÔLE : Schéma de base de données PostgreSQL Drizzle ORM.
 * EXPLICATION :
 * Ce fichier décrit la structure d'une table PostgreSQL et ses contraintes.
 * 1. Définit les colonnes, types, clés primaires et relations.
 * 2. Assure un typage strict entre la base de données et le code TypeScript.
 * ============================================================================
 */

import { pgTable, uuid, varchar, text, jsonb, timestamp, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users';

/**
 * Journal centralisé des actions administratives et métier importantes.
 * Couvre l'ensemble du système (pas uniquement les tickets).
 * Immuable : pas d'UPDATE ni de DELETE.
 */
/** Table PostgreSQL `auditLogs` : Définition des colonnes, contraintes et index. */
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    action: varchar('action', { length: 100 }).notNull(),
    entityType: varchar('entity_type', { length: 50 }).notNull(),
    entityId: uuid('entity_id').notNull(),
    oldValue: jsonb('old_value'),
    newValue: jsonb('new_value'),
    ipAddress: varchar('ip_address', { length: 45 }),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    idxAuditLogsUser: index('idx_audit_logs_user').on(table.userId),
    idxAuditLogsAction: index('idx_audit_logs_action').on(table.action),
    idxAuditLogsEntity: index('idx_audit_logs_entity').on(table.entityType, table.entityId),
    idxAuditLogsCreatedAt: index('idx_audit_logs_created_at').on(table.createdAt),
  }),
);

/** Relations ORM `auditLogsRelations` : Définition des jointures et associations Drizzle. */
export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  user: one(users, {
    fields: [auditLogs.userId],
    references: [users.id],
  }),
}));

export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
