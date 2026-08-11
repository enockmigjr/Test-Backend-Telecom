/**
 * ============================================================================
 * FICHIER : src/database/schemas/categories.ts
 * RÔLE : Schéma de base de données PostgreSQL Drizzle ORM.
 * EXPLICATION :
 * Ce fichier décrit la structure d'une table PostgreSQL et ses contraintes.
 * 1. Définit les colonnes, types, clés primaires et relations.
 * 2. Assure un typage strict entre la base de données et le code TypeScript.
 * ============================================================================
 */

import { pgTable, uuid, varchar, text, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { tickets } from './tickets';
import { slaPolicies } from './sla-policies';

/**
 * Table des catégories de tickets d'incidents (dynamique).
 */
/** Table PostgreSQL `categories` : Définition des colonnes, contraintes et index. */
export const categories = pgTable('categories', {
  id: uuid('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  description: text('description'),
  /** Rôles d'agents ciblés par l'auto-assignation (un ou plusieurs). */
  targetRoles: jsonb('target_roles'),
  /** Rôle cible unique historique, conservé pour compatibilité. */
  targetRole: varchar('target_role', { length: 100 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

/** Relations ORM `categoriesRelations` : Définition des jointures et associations Drizzle. */
export const categoriesRelations = relations(categories, ({ many }) => ({
  tickets: many(tickets),
  slaPolicies: many(slaPolicies),
}));

export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;
