import { relations } from 'drizzle-orm';
import { index, jsonb, pgTable, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { integrationStatusEnum } from './enums';

/** Configuration cloisonnée d'un site ou canal intégrant le support public. */
export const supportIntegrations = pgTable(
  'support_integrations',
  {
    id: uuid('id').primaryKey(),
    publicKey: varchar('public_key', { length: 80 }).notNull(),
    name: varchar('name', { length: 160 }).notNull(),
    status: integrationStatusEnum('status').notNull().default('DRAFT'),
    allowedOrigins: jsonb('allowed_origins').$type<string[]>().notNull().default([]),
    appearance: jsonb('appearance').$type<Record<string, unknown>>().notNull().default({}),
    routingPolicy: jsonb('routing_policy').$type<Record<string, unknown>>().notNull().default({}),
    quotaPolicy: jsonb('quota_policy').$type<Record<string, unknown>>().notNull().default({}),
    trustPolicy: jsonb('trust_policy').$type<Record<string, unknown>>().notNull().default({}),
    features: jsonb('features').$type<Record<string, boolean>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    publicKeyUnique: uniqueIndex('uq_support_integrations_public_key').on(table.publicKey),
    statusIndex: index('idx_support_integrations_status').on(table.status),
  }),
);

export const supportIntegrationsRelations = relations(supportIntegrations, () => ({}));
export type SupportIntegration = typeof supportIntegrations.$inferSelect;
export type NewSupportIntegration = typeof supportIntegrations.$inferInsert;
