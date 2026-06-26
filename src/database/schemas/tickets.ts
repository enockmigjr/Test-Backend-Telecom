import { pgTable, uuid, varchar, text, boolean, timestamp, index, uniqueIndex, jsonb } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { departments } from './departments';
import { users } from './users';
import { slaPolicies } from './sla-policies';
import { ticketStatusEnum, ticketPriorityEnum, ticketSeverityEnum, ticketCategoryEnum } from './enums';

/**
 * Table principale des tickets d'incidents.
 * Chaque enregistrement représente un incident télécom.
 */
export const tickets = pgTable(
  'tickets',
  {
    id: uuid('id').primaryKey(),
    ticketNumber: varchar('ticket_number', { length: 30 }).notNull().unique(),
    title: varchar('title', { length: 255 }).notNull(),
    description: text('description').notNull(),
    status: ticketStatusEnum('status').notNull().default('NEW'),
    priority: ticketPriorityEnum('priority').notNull(),
    severity: ticketSeverityEnum('severity').notNull(),
    category: ticketCategoryEnum('category').notNull(),
    slaPolicyId: uuid('sla_policy_id')
      .notNull()
      .references(() => slaPolicies.id),
    customerAccountNumber: varchar('customer_account_number', { length: 100 }),
    customerName: varchar('customer_name', { length: 255 }),
    customerContact: varchar('customer_contact', { length: 255 }),
    departmentId: uuid('department_id')
      .notNull()
      .references(() => departments.id),
    assignedTeamId: uuid('assigned_team_id')
      .notNull()
      .references(() => departments.id),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    assignedTo: uuid('assigned_to').references(() => users.id),
    resolutionSummary: text('resolution_summary'),
    firstResponseAt: timestamp('first_response_at', { withTimezone: true }),
    firstResponseDueAt: timestamp('first_response_due_at', { withTimezone: true }).notNull(),
    resolutionDueAt: timestamp('resolution_due_at', { withTimezone: true }).notNull(),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    slaBreached: boolean('sla_breached').notNull().default(false),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    tags: text('tags'),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => ({
    idxTicketsNumber: uniqueIndex('idx_tickets_number').on(table.ticketNumber),
    idxTicketsStatus: index('idx_tickets_status').on(table.status),
    idxTicketsPriority: index('idx_tickets_priority').on(table.priority),
    idxTicketsSeverity: index('idx_tickets_severity').on(table.severity),
    idxTicketsDepartment: index('idx_tickets_department').on(table.departmentId),
    idxTicketsAssignedTeam: index('idx_tickets_assigned_team').on(table.assignedTeamId),
    idxTicketsAssignedTo: index('idx_tickets_assigned_to').on(table.assignedTo),
    idxTicketsCreatedBy: index('idx_tickets_created_by').on(table.createdBy),
    idxTicketsCreatedAt: index('idx_tickets_created_at').on(table.createdAt),
    idxSlaProcessing: index('idx_sla_processing').on(table.status, table.priority),
  }),
);

export const ticketsRelations = relations(tickets, ({ one }) => ({
  department: one(departments, {
    fields: [tickets.departmentId],
    references: [departments.id],
    relationName: 'department_owner',
  }),
  assignedTeam: one(departments, {
    fields: [tickets.assignedTeamId],
    references: [departments.id],
    relationName: 'assigned_team',
  }),
  creator: one(users, {
    fields: [tickets.createdBy],
    references: [users.id],
  }),
  assignee: one(users, {
    fields: [tickets.assignedTo],
    references: [users.id],
  }),
  slaPolicy: one(slaPolicies, {
    fields: [tickets.slaPolicyId],
    references: [slaPolicies.id],
  }),
}));

export type Ticket = typeof tickets.$inferSelect;
export type NewTicket = typeof tickets.$inferInsert;
