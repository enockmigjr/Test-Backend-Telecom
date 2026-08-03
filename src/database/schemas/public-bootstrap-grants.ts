import { sql } from 'drizzle-orm';
import { check, foreignKey, index, pgTable, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { externalRequesters } from './external-requesters';
import { supportIntegrations } from './support-integrations';
import { trustedDevices } from './trusted-devices';

/** Code opaque court servant uniquement au transfert iframe vers portail pleine page. */
export const publicBootstrapGrants = pgTable(
  'public_bootstrap_grants',
  {
    id: uuid('id').primaryKey(),
    supportIntegrationId: uuid('support_integration_id').notNull(),
    externalRequesterId: uuid('external_requester_id').notNull(),
    trustedDeviceId: uuid('trusted_device_id').notNull(),
    codeHash: varchar('code_hash', { length: 128 }).notNull(),
    audience: varchar('audience', { length: 160 }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    codeUnique: uniqueIndex('uq_public_bootstrap_grants_code_hash').on(table.codeHash),
    expirationIndex: index('idx_public_bootstrap_grants_expires_at').on(table.expiresAt),
    integrationForeignKey: foreignKey({
      columns: [table.supportIntegrationId],
      foreignColumns: [supportIntegrations.id],
      name: 'public_bootstrap_grants_integration_fk',
    }).onDelete('restrict'),
    requesterIntegrationForeignKey: foreignKey({
      columns: [table.externalRequesterId, table.supportIntegrationId],
      foreignColumns: [externalRequesters.id, externalRequesters.supportIntegrationId],
      name: 'public_bootstrap_grants_requester_integration_fk',
    }).onDelete('restrict'),
    trustedDeviceSubjectForeignKey: foreignKey({
      columns: [table.trustedDeviceId, table.supportIntegrationId, table.externalRequesterId],
      foreignColumns: [trustedDevices.id, trustedDevices.supportIntegrationId, trustedDevices.externalRequesterId],
      name: 'public_bootstrap_grants_device_subject_fk',
    }).onDelete('restrict'),
    expirationCheck: check('public_bootstrap_grants_expiration_check', sql`${table.expiresAt} > ${table.createdAt}`),
  }),
);

export type PublicBootstrapGrant = typeof publicBootstrapGrants.$inferSelect;
