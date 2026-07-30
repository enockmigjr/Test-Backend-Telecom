import { relations } from 'drizzle-orm';
import { categories } from './categories';
import { departments } from './departments';
import { externalRequesters } from './external-requesters';
import { slaPolicies } from './sla-policies';
import { supportIntegrations } from './support-integrations';
import { tickets } from './tickets';
import { users } from './users';

/** Relations du ticket séparées du schéma pour maintenir un fichier de table focalisé. */
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
  creator: one(users, { fields: [tickets.createdBy], references: [users.id] }),
  opener: one(users, {
    fields: [tickets.openedByUserId],
    references: [users.id],
    relationName: 'ticket_opener',
  }),
  requester: one(externalRequesters, {
    fields: [tickets.requesterId],
    references: [externalRequesters.id],
  }),
  supportIntegration: one(supportIntegrations, {
    fields: [tickets.supportIntegrationId],
    references: [supportIntegrations.id],
  }),
  assignee: one(users, { fields: [tickets.assignedTo], references: [users.id] }),
  slaPolicy: one(slaPolicies, { fields: [tickets.slaPolicyId], references: [slaPolicies.id] }),
  category: one(categories, { fields: [tickets.categoryId], references: [categories.id] }),
}));
