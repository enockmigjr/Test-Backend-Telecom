/**
 * ============================================================================
 * FICHIER : src/database/schemas/refresh-tokens.ts
 * RÔLE : Schéma de base de données PostgreSQL Drizzle ORM.
 * EXPLICATION :
 * Ce fichier décrit la structure d'une table PostgreSQL et ses contraintes.
 * 1. Définit les colonnes, types, clés primaires et relations.
 * 2. Assure un typage strict entre la base de données et le code TypeScript.
 * ============================================================================
 */

import { pgTable, uuid, text, varchar, timestamp, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users';

/**
 * Refresh tokens actifs.
 * Les tokens sont hachés (SHA-256) avant stockage.
 */
/** Table PostgreSQL `refreshTokens` : Définition des colonnes, contraintes et index. */
export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: uuid('id').primaryKey(),
    familyId: uuid('family_id').notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    tokenHash: text('token_hash').notNull(),
    userAgent: text('user_agent'),
    ipAddress: varchar('ip_address', { length: 45 }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    idxRefreshTokensUser: index('idx_refresh_tokens_user').on(table.userId),
    idxRefreshTokensHash: index('idx_refresh_tokens_hash').on(table.tokenHash),
    idxRefreshTokensFamily: index('idx_refresh_tokens_family').on(table.familyId),
  }),
);

/** Relations ORM `refreshTokensRelations` : Définition des jointures et associations Drizzle. */
export const refreshTokensRelations = relations(refreshTokens, ({ one }) => ({
  user: one(users, {
    fields: [refreshTokens.userId],
    references: [users.id],
  }),
}));

export type RefreshToken = typeof refreshTokens.$inferSelect;
export type NewRefreshToken = typeof refreshTokens.$inferInsert;
