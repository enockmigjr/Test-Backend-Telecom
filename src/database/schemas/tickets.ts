/**
 * ============================================================================
 * FICHIER : src/database/schemas/tickets.ts
 * RÔLE : Schéma Drizzle ORM de la table PostgreSQL `tickets`.
 * EXPLICATION :
 * Cette table est le cœur de la plateforme. Chaque ligne correspond à un ticket
 * d'incident télécom (ex: défaillance réseau, problème de facturation, coupure de fibre).
 * Elle contient l'historique complet des statuts, les priorités, le client concerné,
 * l'agent/équipe responsable, ainsi que les jalons de temps SLA (délais de 1ère réponse
 * et de résolution).
 * ============================================================================
 */

import {
  check,
  foreignKey,
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  index,
  uniqueIndex,
  unique,
  jsonb,
  integer,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { departments } from './departments';
import { users } from './users';
import { slaPolicies } from './sla-policies';
import { categories } from './categories';
import { externalRequesters } from './external-requesters';
import { supportIntegrations } from './support-integrations';
import { supportChannelEnum, ticketStatusEnum, ticketPriorityEnum, ticketSeverityEnum } from './enums';

/**
 * Table `tickets` (Tickets d'incidents telecom)
 */
/** Table PostgreSQL `tickets` : Définition des colonnes, contraintes et index. */
export const tickets = pgTable(
  'tickets',
  {
    // Identifiant unique UUID (v7) du ticket
    id: uuid('id').primaryKey(),
    // Numéro lisible unique du ticket (ex: INC-2026-00042)
    ticketNumber: varchar('ticket_number', { length: 30 }).notNull().unique(),
    // Titre court récapitulatif du problème
    title: varchar('title', { length: 255 }).notNull(),
    // Description détaillée de l'incident
    description: text('description').notNull(),
    // Statut courant du ticket (NEW, ASSIGNED, IN_PROGRESS, RESOLVED, CLOSED, etc.)
    status: ticketStatusEnum('status').notNull().default('NEW'),
    // Priorité de traitement (LOW, MEDIUM, HIGH, CRITICAL)
    priority: ticketPriorityEnum('priority').notNull(),
    // Sévérité de l'incident (S1 à S4)
    severity: ticketSeverityEnum('severity').notNull(),
    // Catégorie fonctionnelle du ticket (Réseau, Facturation, Support, etc.)
    categoryId: uuid('category_id')
      .notNull()
      .references(() => categories.id),
    // Politique SLA appliquée à ce ticket
    slaPolicyId: uuid('sla_policy_id')
      .notNull()
      .references(() => slaPolicies.id),
    // Numéro de compte du client télécom impacté
    customerAccountNumber: varchar('customer_account_number', { length: 100 }),
    // Nom ou raison sociale du client
    customerName: varchar('customer_name', { length: 255 }),
    // Coordonnées de contact du client (téléphone, email)
    customerContact: varchar('customer_contact', { length: 255 }),
    // Département propriétaire de l'incident
    departmentId: uuid('department_id')
      .notNull()
      .references(() => departments.id),
    // Équipe affectée au traitement du ticket
    assignedTeamId: uuid('assigned_team_id')
      .notNull()
      .references(() => departments.id),
    // Utilisateur ayant créé le ticket
    createdBy: uuid('created_by').references(() => users.id),
    // Colonnes d'acteur canoniques; `created_by` reste écrit pendant la migration progressive.
    openedByUserId: uuid('opened_by_user_id').references(() => users.id),
    requesterId: uuid('requester_id'),
    supportIntegrationId: uuid('support_integration_id').references(() => supportIntegrations.id, {
      onDelete: 'restrict',
    }),
    sourceChannel: supportChannelEnum('source_channel').notNull().default('INTERNAL'),
    // Agent ou technicien individuel attribué (peut être null au départ)
    assignedTo: uuid('assigned_to').references(() => users.id),
    // Résumé de la solution apportée lors de la résolution
    resolutionSummary: text('resolution_summary'),
    // Date/heure effective de la 1ère prise en charge par un agent
    firstResponseAt: timestamp('first_response_at', { withTimezone: true }),
    // Date limite SLA pour la 1ère prise en charge
    firstResponseDueAt: timestamp('first_response_due_at', { withTimezone: true }).notNull(),
    // Horodatage de l'avertissement SLA 1ère réponse envoyé
    firstResponseWarningSentAt: timestamp('first_response_warning_sent_at', { withTimezone: true }),
    // Horodatage du dépassement (dépassement SLA 1ère réponse)
    firstResponseBreachedAt: timestamp('first_response_breached_at', { withTimezone: true }),
    // Date limite SLA globale de résolution de l'incident
    resolutionDueAt: timestamp('resolution_due_at', { withTimezone: true }).notNull(),
    // Horodatage de l'avertissement de résolution imminente
    resolutionWarningSentAt: timestamp('resolution_warning_sent_at', { withTimezone: true }),
    // Horodatage du dépassement de délai de résolution SLA
    resolutionBreachedAt: timestamp('resolution_breached_at', { withTimezone: true }),
    // Date/heure effective de résolution de l'incident
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    // Drapeau indiquant si le ticket a violé au moins un SLA
    slaBreached: boolean('sla_breached').notNull().default(false),
    // Date de clôture définitive du ticket
    closedAt: timestamp('closed_at', { withTimezone: true }),
    // Mots-clés ou étiquettes associés au ticket
    tags: text('tags'),
    // Métadonnées système additionnelles au format JSON
    metadata: jsonb('metadata'),
    // Date d'entrée en pause du chronomètre SLA (ex: en attente du client)
    slaPausedAt: timestamp('sla_paused_at', { withTimezone: true }),
    // Temps cumulé en ms pendant lequel le SLA a été en pause
    accumulatedPauseMs: integer('accumulated_pause_ms').notNull().default(0),
    // Date de création du ticket
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    // Date de dernière modification du ticket
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    // Supprimé le (Soft Delete)
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => ({
    // Index pour accélérer les recherches sur les champs fréquents
    idxTicketsNumber: uniqueIndex('idx_tickets_number').on(table.ticketNumber),
    idxTicketsStatus: index('idx_tickets_status').on(table.status),
    idxTicketsPriority: index('idx_tickets_priority').on(table.priority),
    idxTicketsSeverity: index('idx_tickets_severity').on(table.severity),
    idxTicketsDepartment: index('idx_tickets_department').on(table.departmentId),
    idxTicketsAssignedTeam: index('idx_tickets_assigned_team').on(table.assignedTeamId),
    idxTicketsAssignedTo: index('idx_tickets_assigned_to').on(table.assignedTo),
    idxTicketsCreatedBy: index('idx_tickets_created_by').on(table.createdBy),
    idxTicketsOpenedBy: index('idx_tickets_opened_by').on(table.openedByUserId),
    idxTicketsRequester: index('idx_tickets_requester').on(table.supportIntegrationId, table.requesterId),
    integrationIdentityUnique: unique('uq_tickets_id_integration').on(table.id, table.supportIntegrationId),
    idxTicketsCreatedAt: index('idx_tickets_created_at').on(table.createdAt),
    idxSlaProcessing: index('idx_sla_processing').on(table.status, table.priority),
    requesterIntegrationForeignKey: foreignKey({
      columns: [table.requesterId, table.supportIntegrationId],
      foreignColumns: [externalRequesters.id, externalRequesters.supportIntegrationId],
      name: 'tickets_requester_integration_fk',
    }).onDelete('restrict'),
    actorPresenceCheck: check(
      'tickets_actor_presence_check',
      sql`num_nonnulls(${table.createdBy}, ${table.openedByUserId}, ${table.requesterId}) >= 1`,
    ),
    legacyCreatorCheck: check(
      'tickets_legacy_creator_check',
      sql`${table.createdBy} IS NULL OR ${table.createdBy} = ${table.openedByUserId}`,
    ),
    requesterIntegrationCheck: check(
      'tickets_requester_integration_check',
      sql`num_nonnulls(${table.requesterId}, ${table.supportIntegrationId}) IN (0, 2)`,
    ),
  }),
);

/**
 * Relations Drizzle du ticket avec son créateur, son sous-traitant, sa catégorie, son département, etc.
 */
/** Relations ORM `ticketsRelations` : Définition des jointures et associations Drizzle. */
/**
 * Types TypeScript dérivés pour la sélection et l'insertion de tickets.
 */
export type Ticket = typeof tickets.$inferSelect;
export type NewTicket = typeof tickets.$inferInsert;
