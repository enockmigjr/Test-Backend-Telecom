import { relations, sql } from 'drizzle-orm';
import { check, index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { supportIntegrations } from './support-integrations';

/** Secret d'intégration chiffré et versionné; aucune valeur claire n'est persistée. */
export const integrationCredentials = pgTable(
  'integration_credentials',
  {
    id: uuid('id').primaryKey(),
    supportIntegrationId: uuid('support_integration_id')
      .notNull()
      .references(() => supportIntegrations.id, { onDelete: 'restrict' }),
    version: integer('version').notNull(),
    encryptedSecret: text('encrypted_secret').notNull(),
    encryptionKeyVersion: integer('encryption_key_version').notNull(),
    activeFrom: timestamp('active_from', { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    integrationVersionUnique: uniqueIndex('uq_integration_credentials_version').on(
      table.supportIntegrationId,
      table.version,
    ),
    integrationIndex: index('idx_integration_credentials_integration').on(table.supportIntegrationId),
    versionsCheck: check(
      'integration_credentials_versions_check',
      sql`${table.version} > 0 AND ${table.encryptionKeyVersion} > 0`,
    ),
  }),
);

export const integrationCredentialsRelations = relations(integrationCredentials, ({ one }) => ({
  integration: one(supportIntegrations, {
    fields: [integrationCredentials.supportIntegrationId],
    references: [supportIntegrations.id],
  }),
}));
export type IntegrationCredential = typeof integrationCredentials.$inferSelect;
