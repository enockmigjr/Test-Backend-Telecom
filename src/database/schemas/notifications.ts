import { pgTable, uuid, varchar, text, boolean, timestamp, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users';
import { notificationTypeEnum } from './enums';

/**
 * Notifications persistantes. Source de vérité du système de notification.
 * Les WebSockets servent uniquement à la diffusion temps réel.
 */
export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    type: notificationTypeEnum('type').notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    message: text('message').notNull(),
    referenceType: varchar('reference_type', { length: 50 }),
    referenceId: uuid('reference_id'),
    isRead: boolean('is_read').notNull().default(false),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    idxNotificationsUser: index('idx_notifications_user').on(table.userId),
    idxNotificationsUnread: index('idx_notifications_unread').on(table.userId, table.isRead),
  }),
);

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
}));

export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
