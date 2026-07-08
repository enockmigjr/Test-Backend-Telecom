import { pgTable, uuid, varchar, text, timestamp, boolean, integer, jsonb } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users';
import { tickets } from './tickets';

/**
 * Départements de l'organisation télécom.
 */
export const departments = pgTable('departments', {
  id: uuid('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  description: text('description'),
  autoAssignmentEnabled: boolean('auto_assignment_enabled').notNull().default(true),
  assignmentStrategy: varchar('assignment_strategy', { length: 50 }).notNull().default('LEAST_LOADED'),
  maxWorkloadPerAgent: integer('max_workload_per_agent').notNull().default(100),
  workloadWeights: jsonb('workload_weights'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export const departmentsRelations = relations(departments, ({ many }) => ({
  users: many(users),
  ownedTickets: many(tickets, { relationName: 'department_owner' }),
  assignedTickets: many(tickets, { relationName: 'assigned_team' }),
}));

export type Department = typeof departments.$inferSelect;
export type NewDepartment = typeof departments.$inferInsert;
