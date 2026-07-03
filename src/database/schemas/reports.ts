import { pgTable, uuid, varchar, text, jsonb, timestamp, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users';

/**
 * Table de suivi des rapports générés de manière asynchrone.
 */
export const reports = pgTable(
  'reports',
  {
    id: uuid('id').primaryKey(),
    type: varchar('type', { length: 50 }).notNull(), // 'ticket-report', 'sla-report', 'weekly-report'
    status: varchar('status', { length: 20 }).notNull().default('pending'), // 'pending', 'completed', 'failed'
    objectKey: varchar('object_key', { length: 255 }), // null si failed ou pending
    requestedBy: uuid('requested_by')
      .notNull()
      .references(() => users.id),
    errorMessage: text('error_message'), // Contient l'erreur si status = failed
    metadata: jsonb('metadata'), // Paramètres du rapport (ex: ticketId, de/a, etc.)
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (table) => ({
    idxReportsRequestedBy: index('idx_reports_requested_by').on(table.requestedBy),
    idxReportsStatus: index('idx_reports_status').on(table.status),
  }),
);

export const reportsRelations = relations(reports, ({ one }) => ({
  requester: one(users, {
    fields: [reports.requestedBy],
    references: [users.id],
  }),
}));

export type Report = typeof reports.$inferSelect;
export type NewReport = typeof reports.$inferInsert;
