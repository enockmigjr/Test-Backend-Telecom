import { relations } from 'drizzle-orm';
import { foreignKey, index, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { externalIdentityTypeEnum } from './enums';
import { externalRequesters } from './external-requesters';
import { supportIntegrations } from './support-integrations';

/** Identité vérifiée, isolée par intégration et retrouvée via une empreinte normalisée. */
export const externalIdentities = pgTable(
  'external_identities',
  {
    id: uuid('id').primaryKey(),
    supportIntegrationId: uuid('support_integration_id')
      .notNull()
      .references(() => supportIntegrations.id, { onDelete: 'restrict' }),
    externalRequesterId: uuid('external_requester_id').notNull(),
    identityType: externalIdentityTypeEnum('identity_type').notNull(),
    normalizedValueHash: varchar('normalized_value_hash', { length: 128 }).notNull(),
    encryptedValue: text('encrypted_value').notNull(),
    providerSubject: varchar('provider_subject', { length: 255 }),
    verifiedAt: timestamp('verified_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    identityUnique: uniqueIndex('uq_external_identities_integration_type_hash').on(
      table.supportIntegrationId,
      table.identityType,
      table.normalizedValueHash,
    ),
    requesterIndex: index('idx_external_identities_requester').on(table.externalRequesterId),
    requesterIntegrationForeignKey: foreignKey({
      columns: [table.externalRequesterId, table.supportIntegrationId],
      foreignColumns: [externalRequesters.id, externalRequesters.supportIntegrationId],
      name: 'external_identities_requester_integration_fk',
    }).onDelete('restrict'),
  }),
);

export const externalIdentitiesRelations = relations(externalIdentities, ({ one }) => ({
  requester: one(externalRequesters, {
    fields: [externalIdentities.externalRequesterId],
    references: [externalRequesters.id],
  }),
  integration: one(supportIntegrations, {
    fields: [externalIdentities.supportIntegrationId],
    references: [supportIntegrations.id],
  }),
}));
export type ExternalIdentity = typeof externalIdentities.$inferSelect;
