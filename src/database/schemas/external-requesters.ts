import { relations } from 'drizzle-orm';
import { index, jsonb, pgTable, timestamp, unique, uuid, varchar } from 'drizzle-orm/pg-core';
import { supportIntegrations } from './support-integrations';

/** Profil public conservé côté serveur, sans créer de compte utilisateur interne. */
export const externalRequesters = pgTable(
  'external_requesters',
  {
    id: uuid('id').primaryKey(),
    supportIntegrationId: uuid('support_integration_id')
      .notNull()
      .references(() => supportIntegrations.id, { onDelete: 'restrict' }),
    displayName: varchar('display_name', { length: 160 }),
    locale: varchar('locale', { length: 16 }).notNull().default('fr'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
    anonymizedAt: timestamp('anonymized_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    integrationIndex: index('idx_external_requesters_integration').on(table.supportIntegrationId),
    integrationSubjectUnique: unique('uq_external_requesters_id_integration').on(
      table.id,
      table.supportIntegrationId,
    ),
    integrationCreatedIndex: index('idx_external_requesters_integration_created').on(
      table.supportIntegrationId,
      table.createdAt,
    ),
  }),
);

export const externalRequestersRelations = relations(externalRequesters, ({ one }) => ({
  integration: one(supportIntegrations, {
    fields: [externalRequesters.supportIntegrationId],
    references: [supportIntegrations.id],
  }),
}));
export type ExternalRequester = typeof externalRequesters.$inferSelect;
export type NewExternalRequester = typeof externalRequesters.$inferInsert;
