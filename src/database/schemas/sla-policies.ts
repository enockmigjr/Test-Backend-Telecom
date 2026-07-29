/**
 * ============================================================================
 * FICHIER : src/database/schemas/sla-policies.ts
 * RÔLE : Schéma de base de données PostgreSQL Drizzle ORM.
 * EXPLICATION :
 * Ce fichier décrit la structure d'une table PostgreSQL et ses contraintes.
 * 1. Définit les colonnes, types, clés primaires et relations.
 * 2. Assure un typage strict entre la base de données et le code TypeScript.
 * ============================================================================
 */

import { pgTable, uuid, integer, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { ticketPriorityEnum } from './enums';
import { categories } from './categories';

/**
 * Politiques SLA définissant les délais de réponse et résolution
 * pour chaque combinaison catégorie + priorité.
 */
/** Table PostgreSQL `slaPolicies` : Définition des colonnes, contraintes et index. */
export const slaPolicies = pgTable(
  'sla_policies',
  {
    id: uuid('id').primaryKey(),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => categories.id),
    priority: ticketPriorityEnum('priority').notNull(),
    firstResponseMinutes: integer('first_response_minutes').notNull(),
    resolutionMinutes: integer('resolution_minutes').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    idxSlaPoliciesCategoryPriority: uniqueIndex('idx_sla_policies_category_priority').on(
      table.categoryId,
      table.priority,
    ),
  }),
);

/** Relations ORM `slaPoliciesRelations` : Définition des jointures et associations Drizzle. */
export const slaPoliciesRelations = relations(slaPolicies, ({ one }) => ({
  category: one(categories, {
    fields: [slaPolicies.categoryId],
    references: [categories.id],
  }),
}));

export type SlaPolicy = typeof slaPolicies.$inferSelect;
export type NewSlaPolicy = typeof slaPolicies.$inferInsert;
