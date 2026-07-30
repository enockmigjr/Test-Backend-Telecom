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

import { relations, sql } from 'drizzle-orm';
import { check, foreignKey, index, jsonb, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { actorTypeEnum } from './enums';
import { externalRequesters } from './external-requesters';
import { supportIntegrations } from './support-integrations';
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
    userId: uuid('user_id').references(() => users.id),
    actorType: actorTypeEnum('actor_type').notNull().default('INTERNAL'),
    externalRequesterId: uuid('external_requester_id'),
    supportIntegrationId: uuid('support_integration_id').references(() => supportIntegrations.id, {
      onDelete: 'restrict',
    }),

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
    idxHistoryCreatedAt: index('idx_history_created_at').on(table.createdAt),
    idxHistoryRequester: index('idx_ticket_history_requester').on(
      table.supportIntegrationId,
      table.externalRequesterId,
    ),
    requesterIntegrationForeignKey: foreignKey({
      columns: [table.externalRequesterId, table.supportIntegrationId],
      foreignColumns: [externalRequesters.id, externalRequesters.supportIntegrationId],
      name: 'ticket_history_requester_integration_fk',
    }).onDelete('restrict'),
    ticketIntegrationForeignKey: foreignKey({
      columns: [table.ticketId, table.supportIntegrationId],
      foreignColumns: [tickets.id, tickets.supportIntegrationId],
      name: 'ticket_history_ticket_integration_fk',
    }).onDelete('restrict'),
    actorVariantCheck: check(
      'ticket_history_actor_variant_check',
      sql`(${table.actorType} = 'INTERNAL' AND ${table.userId} IS NOT NULL AND ${table.externalRequesterId} IS NULL)
        OR (${table.actorType} = 'EXTERNAL_REQUESTER' AND ${table.userId} IS NULL
          AND ${table.externalRequesterId} IS NOT NULL AND ${table.supportIntegrationId} IS NOT NULL)
        OR (${table.actorType} = 'SYSTEM' AND ${table.userId} IS NULL AND ${table.externalRequesterId} IS NULL)`,
    ),
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
  requester: one(externalRequesters, {
    fields: [ticketHistory.externalRequesterId],
    references: [externalRequesters.id],
  }),
}));

/** Type TypeScript représentant une ligne lue depuis la table `ticket_history`. */
export type TicketHistory = typeof ticketHistory.$inferSelect;

/** Type TypeScript représentant l'objet d'insertion pour créer un nouvel événement dans `ticket_history`. */
export type NewTicketHistory = typeof ticketHistory.$inferInsert;
