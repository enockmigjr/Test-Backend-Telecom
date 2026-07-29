/**
 * ============================================================================
 * FICHIER : src/database/schemas/departments.ts
 * RÔLE : Schéma de base de données PostgreSQL Drizzle ORM.
 * EXPLICATION :
 * Ce fichier décrit la structure d'une table PostgreSQL et ses contraintes.
 * 1. Définit les colonnes, types, clés primaires et relations.
 * 2. Assure un typage strict entre la base de données et le code TypeScript.
 * ============================================================================
 */

import { pgTable, uuid, varchar, text, timestamp, boolean, integer, jsonb } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users';
import { tickets } from './tickets';

/**
 * Départements de l'organisation télécom.
 */
/** Table PostgreSQL `departments` : Définition des colonnes, contraintes et index. */
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

/** Relations ORM `departmentsRelations` : Définition des jointures et associations Drizzle. */
export const departmentsRelations = relations(departments, ({ many }) => ({
  users: many(users),
  ownedTickets: many(tickets, { relationName: 'department_owner' }),
  assignedTickets: many(tickets, { relationName: 'assigned_team' }),
}));

export type Department = typeof departments.$inferSelect;
export type NewDepartment = typeof departments.$inferInsert;
