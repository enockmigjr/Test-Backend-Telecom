/**
 * ============================================================================
 * FICHIER : src/database/schemas/ticket-assignments.ts
 * RÔLE : Schéma de base de données PostgreSQL Drizzle ORM.
 * EXPLICATION :
 * Ce fichier décrit la structure d'une table PostgreSQL et ses contraintes.
 * 1. Définit les colonnes, types, clés primaires et relations.
 * 2. Assure un typage strict entre la base de données et le code TypeScript.
 * ============================================================================
 */

import { relations, sql } from 'drizzle-orm';
import { check, index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { actorTypeEnum } from './enums';
import { tickets } from './tickets';
import { users } from './users';
import { departments } from './departments';

/**
 * Historique des affectations de tickets.
 * Chaque changement d'assigné ou de département crée un nouvel enregistrement.
 */
/** Table PostgreSQL `ticketAssignments` : Définition des colonnes, contraintes et index. */
export const ticketAssignments = pgTable(
  'ticket_assignments',
  {
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
    assignedBy: uuid('assigned_by').references(() => users.id),
    actorType: actorTypeEnum('actor_type').notNull().default('INTERNAL'),
    reason: text('reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    ticketIndex: index('idx_ticket_assignments_ticket').on(table.ticketId, table.createdAt),
    actorVariantCheck: check(
      'ticket_assignments_actor_variant_check',
      sql`(${table.actorType} = 'INTERNAL' AND ${table.assignedBy} IS NOT NULL)
      OR (${table.actorType} = 'SYSTEM' AND ${table.assignedBy} IS NULL)`,
    ),
  }),
);

/** Relations ORM `ticketAssignmentsRelations` : Définition des jointures et associations Drizzle. */
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
