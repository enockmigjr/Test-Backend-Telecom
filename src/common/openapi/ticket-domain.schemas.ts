/**
 * ============================================================================
 * FICHIER : src/common/openapi/ticket-domain.schemas.ts
 * RÔLE : Définitions OpenAPI Swagger pour le domaine des Tickets d'incidents Télécom.
 * EXPLICATION :
 * Ce module répertorie les schémas JSON Schema décrivant l'entité centrale des Tickets d'incidents :
 * 1. `TicketListItem` : Version allégée d'un ticket pour les affichages en liste et tableaux de bord.
 * 2. `Ticket` : Représentation détaillée avec relations Drizzle (catégorie, département, créateur, assigné, échéances SLA, compteurs).
 * 3. `TicketRelationCounts` : Compteurs d'associations de second niveau (`commentCount`, `assignmentCount`).
 * 4. `Assignment` & `AssignmentPage` : Enregistrement et pagination de l'historique des réassignations et escalades.
 * 5. `TicketHistory` : Journal des modifications de champs d'un ticket (actions, instantanés avant/après).
 * ============================================================================
 */

import { SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';

import {
  dateTime,
  jsonValue,
  nullableDateTime,
  nullableString,
  priority,
  severity,
  ticketStatus,
  uuid,
} from './schema-helpers';

/** Propriétés de base d'un ticket dans un affichage en liste. */
const ticketListProperties: Record<string, SchemaObject> = {
  id: uuid,
  ticketNumber: { type: 'string' },
  title: { type: 'string' },
  status: ticketStatus,
  priority,
  severity,
  categoryId: uuid,
  categoryName: nullableString,
  assignedTo: { ...uuid, nullable: true },
  customerName: nullableString,
  createdAt: dateTime,
  updatedAt: dateTime,
};

/**
 * Schémas OpenAPI Swagger exportés pour les tickets d'incidents.
 */
export const TICKET_DOMAIN_SCHEMAS: Record<string, SchemaObject> = {
  TicketListItem: {
    type: 'object',
    required: ['id', 'ticketNumber', 'title', 'status', 'priority', 'severity', 'categoryId', 'createdAt', 'updatedAt'],
    properties: ticketListProperties,
  },
  Ticket: {
    type: 'object',
    required: [
      'id',
      'ticketNumber',
      'title',
      'description',
      'status',
      'priority',
      'severity',
      'categoryId',
      'slaPolicyId',
      'departmentId',
      'assignedTeamId',
      'createdBy',
      'createdAt',
      'updatedAt',
    ],
    properties: {
      ...ticketListProperties,
      description: { type: 'string' },
      slaPolicyId: uuid,
      customerAccountNumber: nullableString,
      customerContact: nullableString,
      departmentId: uuid,
      assignedTeamId: uuid,
      createdBy: uuid,
      resolutionSummary: nullableString,
      firstResponseAt: nullableDateTime,
      firstResponseDueAt: dateTime,
      firstResponseWarningSentAt: nullableDateTime,
      firstResponseBreachedAt: nullableDateTime,
      resolutionDueAt: dateTime,
      resolutionWarningSentAt: nullableDateTime,
      resolutionBreachedAt: nullableDateTime,
      resolvedAt: nullableDateTime,
      slaBreached: { type: 'boolean' },
      closedAt: nullableDateTime,
      tags: nullableString,
      metadata: jsonValue,
      slaPausedAt: nullableDateTime,
      accumulatedPauseMs: { type: 'integer', minimum: 0 },
      deletedAt: nullableDateTime,
      category: { $ref: '#/components/schemas/Category' },
      department: { $ref: '#/components/schemas/Department' },
      assignedTeam: { $ref: '#/components/schemas/Department' },
      assignee: { $ref: '#/components/schemas/User' },
      creator: { $ref: '#/components/schemas/User' },
      _meta: { $ref: '#/components/schemas/TicketRelationCounts' },
      assignmentHistory: { $ref: '#/components/schemas/AssignmentPage' },
    },
  },
  TicketRelationCounts: {
    type: 'object',
    required: ['commentCount', 'assignmentCount'],
    properties: { commentCount: { type: 'integer' }, assignmentCount: { type: 'integer' } },
  },
  Assignment: {
    type: 'object',
    required: ['id', 'toUserId', 'createdAt'],
    properties: {
      id: uuid,
      fromUserId: { ...uuid, nullable: true },
      toUserId: uuid,
      reason: nullableString,
      createdAt: dateTime,
    },
  },
  AssignmentPage: {
    type: 'object',
    required: ['data', 'meta'],
    properties: {
      data: { type: 'array', items: { $ref: '#/components/schemas/Assignment' } },
      meta: { $ref: '#/components/schemas/PaginationMeta' },
    },
  },
  TicketHistory: {
    type: 'object',
    required: ['id', 'ticketId', 'userId', 'action', 'createdAt'],
    properties: {
      id: uuid,
      ticketId: uuid,
      userId: uuid,
      action: { type: 'string' },
      oldValue: jsonValue,
      newValue: jsonValue,
      metadata: jsonValue,
      createdAt: dateTime,
    },
  },
};
