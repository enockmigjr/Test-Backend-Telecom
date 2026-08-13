/**
 * ============================================================================
 * FICHIER : src/common/openapi/core-domain.schemas.ts
 * RÔLE : Définitions OpenAPI Swagger pour le domaine cœur (Utilisateurs, Départements, SLA, Authentification).
 * EXPLICATION :
 * Ce module contient les schémas JSON Schema pour Swagger UI décrivant les entités fondamentales :
 * 1. `Department` & `Category` : Départements télécom et catégories d'incidents.
 * 2. `User`, `CreatedUser`, `CurrentUser` : Modèles utilisateur avec rôles RBAC (7 rôles), départements et métriques.
 * 3. `CurrentUser` : Profil métier de la session courante (jeton Keycloak).
 * 4. `SlaPolicy` : Règles d'échéance temporelle (première réponse et résolution en minutes).
 * 5. `Setting` : Paramètres système dynamiques enregistrés en base.
 * ============================================================================
 */

import { SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';

import { dateTime, nullableDateTime, nullableString, priority, ticketStatus, uuid } from './schema-helpers';

/** Définition OpenAPI réutilisable de l'énumération des 7 rôles RBAC du système. */
const role: SchemaObject = {
  type: 'string',
  enum: [
    'CUSTOMER_SERVICE_AGENT',
    'NOC_ENGINEER',
    'BILLING_AGENT',
    'TECHNICAL_SUPPORT_ENGINEER',
    'FIELD_TECHNICIAN',
    'SUPERVISOR',
    'ADMINISTRATOR',
  ],
};

/**
 * Schémas OpenAPI Swagger exportés pour le domaine cœur.
 */
export const CORE_DOMAIN_SCHEMAS: Record<string, SchemaObject> = {
  Department: {
    type: 'object',
    required: [
      'id',
      'name',
      'autoAssignmentEnabled',
      'assignmentStrategy',
      'maxWorkloadPerAgent',
      'createdAt',
      'updatedAt',
    ],
    properties: {
      id: uuid,
      name: { type: 'string' },
      description: nullableString,
      autoAssignmentEnabled: { type: 'boolean' },
      assignmentStrategy: { type: 'string' },
      maxWorkloadPerAgent: { type: 'integer' },
      workloadWeights: { type: 'object', nullable: true },
      createdAt: dateTime,
      updatedAt: dateTime,
      deletedAt: nullableDateTime,
    },
  },
  Category: {
    type: 'object',
    required: ['id', 'name', 'createdAt', 'updatedAt'],
    properties: {
      id: uuid,
      name: { type: 'string' },
      description: nullableString,
      targetRole: nullableString,
      createdAt: dateTime,
      updatedAt: dateTime,
    },
  },
  User: {
    type: 'object',
    required: ['id', 'email', 'firstName', 'lastName', 'role', 'departmentId', 'isActive'],
    properties: {
      id: uuid,
      email: { type: 'string', format: 'email' },
      firstName: { type: 'string' },
      lastName: { type: 'string' },
      role,
      departmentId: uuid,
      departmentName: nullableString,
      department: { $ref: '#/components/schemas/Department' },
      isActive: { type: 'boolean' },
      isAvailable: { type: 'boolean' },
      maxConcurrentTickets: { type: 'integer' },
      mustChangePassword: { type: 'boolean' },
      absenceEndsAt: nullableDateTime,
      lastAssignedAt: nullableDateTime,
      lastLoginAt: nullableDateTime,
      createdAt: dateTime,
      updatedAt: dateTime,
      ticketStats: { $ref: '#/components/schemas/UserTicketStats' },
      recentTickets: { type: 'array', items: { $ref: '#/components/schemas/TicketListItem' } },
    },
  },
  UserTicketStats: {
    type: 'object',
    required: ['totalCreated', 'totalAssigned', 'openTickets', 'resolvedTickets', 'slaBreachedCount'],
    properties: {
      totalCreated: { type: 'integer' },
      totalAssigned: { type: 'integer' },
      openTickets: { type: 'integer' },
      resolvedTickets: { type: 'integer' },
      slaBreachedCount: { type: 'integer' },
    },
  },
  CreatedUser: {
    allOf: [
      { $ref: '#/components/schemas/User' },
      { type: 'object', required: ['tempPassword'], properties: { tempPassword: { type: 'string' } } },
    ],
  },
  CurrentUser: {
    type: 'object',
    required: ['sub', 'email', 'role', 'departmentId', 'mustChangePassword', 'jti'],
    properties: {
      sub: uuid,
      id: uuid,
      email: { type: 'string', format: 'email' },
      role,
      departmentId: uuid,
      mustChangePassword: { type: 'boolean' },
      jti: uuid,
    },
  },
  SlaPolicy: {
    type: 'object',
    required: ['id', 'categoryId', 'priority', 'firstResponseMinutes', 'resolutionMinutes'],
    properties: {
      id: uuid,
      categoryId: uuid,
      categoryName: { type: 'string' },
      priority,
      firstResponseMinutes: { type: 'integer', minimum: 1 },
      resolutionMinutes: { type: 'integer', minimum: 1 },
      createdAt: dateTime,
      updatedAt: dateTime,
    },
  },
  Setting: {
    type: 'object',
    required: ['id', 'key', 'value', 'createdAt', 'updatedAt'],
    properties: {
      id: uuid,
      key: { type: 'string' },
      value: { type: 'string' },
      description: nullableString,
      createdAt: dateTime,
      updatedAt: dateTime,
    },
  },
  RecentTicket: {
    type: 'object',
    properties: {
      id: uuid,
      ticketNumber: { type: 'string' },
      title: { type: 'string' },
      status: ticketStatus,
      priority,
    },
  },
};
