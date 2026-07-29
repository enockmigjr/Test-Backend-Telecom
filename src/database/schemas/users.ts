/**
 * ============================================================================
 * FICHIER : src/database/schemas/users.ts
 * RÔLE : Schéma Drizzle ORM de la table PostgreSQL `users`.
 * EXPLICATION (Pour non-développeurs) :
 * Cette table stocke les comptes des employés et intervenants de l'entreprise.
 * Elle contient leurs informations personnelles (nom, prénom, email), leur mot de passe haché,
 * leur rôle, leur département, ainsi que des informations de disponibilité pour l'attribution
 * automatique des tickets (ex: nombre max de tickets simultanés, statut d'absence).
 * ============================================================================
 */

import { pgTable, uuid, varchar, text, boolean, timestamp, index, uniqueIndex, integer } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { departments } from './departments';
import { roleEnum } from './enums';

/**
 * Table `users` (Utilisateurs)
 */
export const users = pgTable(
  'users',
  {
    // Identifiant unique UUID (v7) de l'utilisateur
    id: uuid('id').primaryKey(),
    // Identifiant du département auquel l'utilisateur est rattaché
    departmentId: uuid('department_id')
      .notNull()
      .references(() => departments.id),
    // Adresse email professionnelle unique sert d'identifiant de connexion
    email: varchar('email', { length: 255 }).notNull().unique(),
    // Mot de passe sécurisé et haché (Argon2id)
    passwordHash: text('password_hash').notNull(),
    // Prénom
    firstName: varchar('first_name', { length: 100 }).notNull(),
    // Nom de famille
    lastName: varchar('last_name', { length: 100 }).notNull(),
    // Rôle fonctionnel (ADMIN, SUPERVISOR, FIELD_TECHNICIAN, etc.)
    role: roleEnum('role').notNull(),
    // Indique si le compte est actif ou désactivé
    isActive: boolean('is_active').notNull().default(true),
    // Indique si l'agent est actuellement disponible pour recevoir de nouveaux tickets
    isAvailable: boolean('is_available').notNull().default(true),
    // Limite de charge : nombre maximal de tickets gérés simultanément (par défaut 5)
    maxConcurrentTickets: integer('max_concurrent_tickets').notNull().default(5),
    // Date/heure d'expiration d'une absence programmée
    absenceEndsAt: timestamp('absence_ends_at', { withTimezone: true }),
    // Horodatage du dernier ticket attribué (utilisé pour l'équilibrage de charge "Round Robin")
    lastAssignedAt: timestamp('last_assigned_at', { withTimezone: true }),
    // Force l'utilisateur à modifier son mot de passe lors de sa prochaine connexion
    mustChangePassword: boolean('must_change_password').notNull().default(false),
    // Horodatage de la dernière connexion réussie
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    // Date de création du compte
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    // Date de dernière mise à jour de la fiche utilisateur
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    // Supprimé le (Soft Delete) : permet de conserver l'historique sans effacer définitivement
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => ({
    // Index pour accélérer les recherches par email, département et rôle
    idxUsersEmail: uniqueIndex('idx_users_email').on(table.email),
    idxUsersDepartment: index('idx_users_department').on(table.departmentId),
    idxUsersRole: index('idx_users_role').on(table.role),
  }),
);

/**
 * Déclaration de la relation Drizzle entre un Utilisateur et son Département.
 */
export const usersRelations = relations(users, ({ one }) => ({
  department: one(departments, {
    fields: [users.departmentId],
    references: [departments.id],
  }),
}));

/**
 * Types TypeScript dérivés pour la sélection et l'insertion d'utilisateurs.
 */
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
