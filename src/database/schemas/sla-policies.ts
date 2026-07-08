import { pgTable, uuid, integer, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { ticketPriorityEnum } from './enums';
import { categories } from './categories';

/**
 * Politiques SLA définissant les délais de réponse et résolution
 * pour chaque combinaison catégorie + priorité.
 */
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

export const slaPoliciesRelations = relations(slaPolicies, ({ one }) => ({
  category: one(categories, {
    fields: [slaPolicies.categoryId],
    references: [categories.id],
  }),
}));

export type SlaPolicy = typeof slaPolicies.$inferSelect;
export type NewSlaPolicy = typeof slaPolicies.$inferInsert;
