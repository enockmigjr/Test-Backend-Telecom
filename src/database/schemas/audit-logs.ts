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

import { relations, sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { actorTypeEnum } from './enums';
import { externalRequesters } from './external-requesters';
import { supportIntegrations } from './support-integrations';
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
    userId: uuid('user_id').references(() => users.id),
    actorType: actorTypeEnum('actor_type').notNull().default('INTERNAL'),
    externalRequesterId: uuid('external_requester_id'),
    supportIntegrationId: uuid('support_integration_id').references(() => supportIntegrations.id, {
      onDelete: 'restrict',
    }),
    action: varchar('action', { length: 100 }).notNull(),
    entityType: varchar('entity_type', { length: 50 }).notNull(),
    entityId: uuid('entity_id').notNull(),
    oldValue: jsonb('old_value'),
    newValue: jsonb('new_value'),
    /** Identifiant d'événement externe (ex. Keycloak) pour la déduplication. */
    sourceEventId: varchar('source_event_id', { length: 64 }),
    ipAddress: varchar('ip_address', { length: 45 }),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    idxAuditLogsUser: index('idx_audit_logs_user').on(table.userId),
    idxAuditLogsAction: index('idx_audit_logs_action').on(table.action),
    idxAuditLogsEntity: index('idx_audit_logs_entity').on(table.entityType, table.entityId),
    idxAuditLogsCreatedAt: index('idx_audit_logs_created_at').on(table.createdAt),
    uqAuditLogsSourceEvent: uniqueIndex('uq_audit_logs_source_event')
      .on(table.sourceEventId)
      .where(sql`${table.sourceEventId} IS NOT NULL`),
    idxAuditLogsRequester: index('idx_audit_logs_requester').on(table.supportIntegrationId, table.externalRequesterId),
    requesterIntegrationForeignKey: foreignKey({
      columns: [table.externalRequesterId, table.supportIntegrationId],
      foreignColumns: [externalRequesters.id, externalRequesters.supportIntegrationId],
      name: 'audit_logs_requester_integration_fk',
    }).onDelete('restrict'),
    actorVariantCheck: check(
      'audit_logs_actor_variant_check',
      sql`(${table.actorType} = 'INTERNAL' AND ${table.userId} IS NOT NULL AND ${table.externalRequesterId} IS NULL)
        OR (${table.actorType} = 'EXTERNAL_REQUESTER' AND ${table.userId} IS NULL
          AND ${table.externalRequesterId} IS NOT NULL AND ${table.supportIntegrationId} IS NOT NULL)
        OR (${table.actorType} = 'SYSTEM' AND ${table.userId} IS NULL AND ${table.externalRequesterId} IS NULL)`,
    ),
  }),
);

/** Relations ORM `auditLogsRelations` : Définition des jointures et associations Drizzle. */
export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  user: one(users, {
    fields: [auditLogs.userId],
    references: [users.id],
  }),
  requester: one(externalRequesters, {
    fields: [auditLogs.externalRequesterId],
    references: [externalRequesters.id],
  }),
}));

export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
