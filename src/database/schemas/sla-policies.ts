import { pgTable, uuid, integer, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { ticketCategoryEnum, ticketPriorityEnum } from './enums';

/**
 * Politiques SLA définissant les délais de réponse et résolution
 * pour chaque combinaison catégorie + priorité.
 */
export const slaPolicies = pgTable(
  'sla_policies',
  {
    id: uuid('id').primaryKey(),
    category: ticketCategoryEnum('category').notNull(),
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
      table.category,
      table.priority,
    ),
  }),
);

export type SlaPolicy = typeof slaPolicies.$inferSelect;
export type NewSlaPolicy = typeof slaPolicies.$inferInsert;
