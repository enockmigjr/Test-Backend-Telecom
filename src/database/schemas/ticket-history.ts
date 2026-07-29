/**
 * ============================================================================
 * FICHIER : src/database/schemas/ticket-history.ts
 * RÔLE : Table d'audit et d'historique immuable des événements sur les tickets.
 * EXPLICATION :
 * Ce schéma définit la table `ticket_history` dans PostgreSQL via Drizzle ORM.
 * Chaque modification apportée à un ticket (création, changement de statut, réassignation, escalade)
 * génère une ligne dans cette table avec un instantané au format JSONB des valeurs avant/après.
 * Cela permet de garantir une traçabilité complète de chaque ticket d'incident.
 * ============================================================================
 */

import { pgTable, uuid, varchar, jsonb, timestamp, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { tickets } from './tickets';
import { users } from './users';

/**
 * Table PostgreSQL `ticket_history` : Journal d'audit d'historique des tickets.
 * Chaque ligne est un enregistrement immuable (append-only) retraçant une action effectuée.
 */
/** Table PostgreSQL `ticketHistory` : Définition des colonnes, contraintes et index. */
export const ticketHistory = pgTable(
  'ticket_history',
  {
    // Identifiant unique du journal d'historique (généré via UUIDv7)
    id: uuid('id').primaryKey(),

    // Référence vers le ticket concerné (clé étrangère vers la table `tickets`)
    ticketId: uuid('ticket_id')
      .notNull()
      .references(() => tickets.id),

    // Référence vers l'utilisateur ayant exécuté l'action (clé étrangère vers `users`)
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),

    // Code de l'action effectuée (ex: 'TICKET_CREATED', 'STATUS_CHANGED', 'ASSIGNED', 'ESCALATED', 'UPDATED')
    action: varchar('action', { length: 100 }).notNull(),

    // Instantané JSONB des attributs du ticket avant la modification (ex: { status: 'NEW' })
    oldValue: jsonb('old_value'),

    // Instantané JSONB des attributs du ticket après la modification (ex: { status: 'IN_PROGRESS' })
    newValue: jsonb('new_value'),

    // Métadonnées additionnelles contextuelles (ex: motif de réouverture, canal de provenance, adresse IP)
    metadata: jsonb('metadata'),

    // Date et heure précises de l'événement avec fuseau horaire (horodatage immuable)
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    // Index pour accélérer la récupération de la chronologie complète d'un ticket spécifique
    idxHistoryTicket: index('idx_history_ticket').on(table.ticketId),

    // Index pour optimiser les recherches par plage de dates dans les rapports d'activité
    idxHistoryCreatedAt: index('idx_history_createdAt').on(table.createdAt),
  }),
);

/**
 * Définition des relations ORM Drizzle pour la table `ticket_history`.
 * Permet de charger le ticket parent ainsi que l'utilisateur auteur de l'action via des jointures typées.
 */
/** Relations ORM `ticketHistoryRelations` : Définition des jointures et associations Drizzle. */
export const ticketHistoryRelations = relations(ticketHistory, ({ one }) => ({
  // Relation N-1 vers le ticket parent
  ticket: one(tickets, {
    fields: [ticketHistory.ticketId],
    references: [tickets.id],
  }),

  // Relation N-1 vers l'utilisateur auteur de l'événement
  user: one(users, {
    fields: [ticketHistory.userId],
    references: [users.id],
  }),
}));

/** Type TypeScript représentant une ligne lue depuis la table `ticket_history`. */
export type TicketHistory = typeof ticketHistory.$inferSelect;

/** Type TypeScript représentant l'objet d'insertion pour créer un nouvel événement dans `ticket_history`. */
export type NewTicketHistory = typeof ticketHistory.$inferInsert;
