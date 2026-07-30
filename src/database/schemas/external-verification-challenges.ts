import { sql } from 'drizzle-orm';
import { check, foreignKey, index, integer, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { externalIdentityTypeEnum, verificationChallengeStatusEnum } from './enums';
import { externalRequesters } from './external-requesters';
import { supportIntegrations } from './support-integrations';

/** Challenge de contact; le code et le contact normalisé ne sont stockés que sous forme d'empreinte. */
export const externalVerificationChallenges = pgTable(
  'external_verification_challenges',
  {
    id: uuid('id').primaryKey(),
    supportIntegrationId: uuid('support_integration_id')
      .notNull()
      .references(() => supportIntegrations.id, { onDelete: 'restrict' }),
    externalRequesterId: uuid('external_requester_id'),
    identityType: externalIdentityTypeEnum('identity_type').notNull(),
    contactHash: varchar('contact_hash', { length: 128 }).notNull(),
    encryptedDestination: text('encrypted_destination').notNull(),
    codeHash: varchar('code_hash', { length: 128 }).notNull(),
    status: verificationChallengeStatusEnum('status').notNull().default('PENDING'),
    attemptCount: integer('attempt_count').notNull().default(0),
    maxAttempts: integer('max_attempts').notNull().default(5),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    lookupIndex: index('idx_external_challenges_lookup').on(
      table.supportIntegrationId,
      table.identityType,
      table.contactHash,
    ),
    expirationIndex: index('idx_external_challenges_expires_at').on(table.expiresAt),
    requesterIntegrationForeignKey: foreignKey({
      columns: [table.externalRequesterId, table.supportIntegrationId],
      foreignColumns: [externalRequesters.id, externalRequesters.supportIntegrationId],
      name: 'external_challenges_requester_integration_fk',
    }).onDelete('restrict'),
    attemptsCheck: check(
      'external_challenges_attempts_check',
      sql`${table.attemptCount} >= 0 AND ${table.maxAttempts} > 0 AND ${table.attemptCount} <= ${table.maxAttempts}`,
    ),
    expirationCheck: check('external_challenges_expiration_check', sql`${table.expiresAt} > ${table.createdAt}`),
  }),
);

export type ExternalVerificationChallenge = typeof externalVerificationChallenges.$inferSelect;
