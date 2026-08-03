import { sql } from 'drizzle-orm';
import { check, foreignKey, index, integer, pgTable, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { externalRequesters } from './external-requesters';
import { supportIntegrations } from './support-integrations';

/** Appareil de confiance révocable; seul le hash du jeton opaque est conservé. */
export const trustedDevices = pgTable(
  'trusted_devices',
  {
    id: uuid('id').primaryKey(),
    supportIntegrationId: uuid('support_integration_id')
      .notNull()
      .references(() => supportIntegrations.id, { onDelete: 'restrict' }),
    externalRequesterId: uuid('external_requester_id').notNull(),
    tokenHash: varchar('token_hash', { length: 128 }).notNull(),
    policyVersion: integer('policy_version').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tokenUnique: uniqueIndex('uq_trusted_devices_token_hash').on(table.tokenHash),
    subjectUnique: uniqueIndex('uq_trusted_devices_subject').on(
      table.id,
      table.supportIntegrationId,
      table.externalRequesterId,
    ),
    requesterIndex: index('idx_trusted_devices_requester').on(table.supportIntegrationId, table.externalRequesterId),
    expirationIndex: index('idx_trusted_devices_expires_at').on(table.expiresAt),
    requesterIntegrationForeignKey: foreignKey({
      columns: [table.externalRequesterId, table.supportIntegrationId],
      foreignColumns: [externalRequesters.id, externalRequesters.supportIntegrationId],
      name: 'trusted_devices_requester_integration_fk',
    }).onDelete('restrict'),
    policyVersionCheck: check('trusted_devices_policy_version_check', sql`${table.policyVersion} > 0`),
    expirationCheck: check('trusted_devices_expiration_check', sql`${table.expiresAt} > ${table.createdAt}`),
  }),
);

export type TrustedDevice = typeof trustedDevices.$inferSelect;
