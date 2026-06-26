import { pgTable, uuid, varchar, text, boolean, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { departments } from './departments';
import { roleEnum } from './enums';

/**
 * Utilisateurs de la plateforme (employés).
 */
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey(),
    departmentId: uuid('department_id')
      .notNull()
      .references(() => departments.id),
    email: varchar('email', { length: 255 }).notNull().unique(),
    passwordHash: text('password_hash').notNull(),
    firstName: varchar('first_name', { length: 100 }).notNull(),
    lastName: varchar('last_name', { length: 100 }).notNull(),
    role: roleEnum('role').notNull(),
    isActive: boolean('is_active').notNull().default(true),
    mustChangePassword: boolean('must_change_password').notNull().default(false),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => ({
    idxUsersEmail: uniqueIndex('idx_users_email').on(table.email),
    idxUsersDepartment: index('idx_users_department').on(table.departmentId),
    idxUsersRole: index('idx_users_role').on(table.role),
  }),
);

export const usersRelations = relations(users, ({ one }) => ({
  department: one(departments, {
    fields: [users.departmentId],
    references: [departments.id],
  }),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
