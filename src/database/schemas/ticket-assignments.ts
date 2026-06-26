import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { tickets } from './tickets';
import { users } from './users';
import { departments } from './departments';

/**
 * Historique des affectations de tickets.
 * Chaque changement d'assigné ou de département crée un nouvel enregistrement.
 */
export const ticketAssignments = pgTable('ticket_assignments', {
  id: uuid('id').primaryKey(),
  ticketId: uuid('ticket_id')
    .notNull()
    .references(() => tickets.id),
  fromUserId: uuid('from_user_id').references(() => users.id),
  toUserId: uuid('to_user_id')
    .notNull()
    .references(() => users.id),
  fromDepartmentId: uuid('from_department_id').references(() => departments.id),
  toDepartmentId: uuid('to_department_id')
    .notNull()
    .references(() => departments.id),
  assignedBy: uuid('assigned_by')
    .notNull()
    .references(() => users.id),
  reason: text('reason'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const ticketAssignmentsRelations = relations(ticketAssignments, ({ one }) => ({
  ticket: one(tickets, {
    fields: [ticketAssignments.ticketId],
    references: [tickets.id],
  }),
  fromUser: one(users, {
    fields: [ticketAssignments.fromUserId],
    references: [users.id],
    relationName: 'assignment_from_user',
  }),
  toUser: one(users, {
    fields: [ticketAssignments.toUserId],
    references: [users.id],
    relationName: 'assignment_to_user',
  }),
  assigner: one(users, {
    fields: [ticketAssignments.assignedBy],
    references: [users.id],
    relationName: 'assignment_by',
  }),
}));

export type TicketAssignment = typeof ticketAssignments.$inferSelect;
export type NewTicketAssignment = typeof ticketAssignments.$inferInsert;
