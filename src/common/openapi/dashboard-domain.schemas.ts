/**
 * ============================================================================
 * FICHIER : src/common/openapi/dashboard-domain.schemas.ts
 * RÔLE : Définitions OpenAPI Swagger pour le domaine du Tableau de Bord (Dashboard).
 * EXPLICATION :
 * Ce module répertorie les schémas Swagger pour les 7 endpoints de supervision du Dashboard :
 * 1. `DashboardOverview` : Vue d'ensemble du volume de tickets, répartition par statut, priorité et taux d'adéquation SLA.
 * 2. `DashboardStatusSeries` : Distribution statistique et âge moyen des tickets par statut.
 * 3. `DashboardPrioritySeries` : Distribution et nombre de violations SLA par niveau de priorité.
 * 4. `DashboardDepartments` : Métriques consolidées de performance et temps moyen de résolution par département.
 * 5. `DashboardWorkload` : Charge de travail en temps réel par agent technico-commercial (tickets ouverts, critiques, en risque).
 * ============================================================================
 */

import { SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';

import { dateTime, nullableString, priority, ticketStatus, uuid } from './schema-helpers';

/** Schéma OpenAPI réutilisable pour les pourcentages (0 à 100). */
const percentage: SchemaObject = { type: 'number', minimum: 0, maximum: 100 };

/** Schéma OpenAPI réutilisable pour les nombres entiers. */
const integer: SchemaObject = { type: 'integer' };

/** Schéma de comptage des tickets ventilés par les 9 statuts. */
const statusCounts: SchemaObject = {
  type: 'object',
  properties: Object.fromEntries(
    [
      'NEW',
      'ASSIGNED',
      'IN_PROGRESS',
      'PENDING_CUSTOMER',
      'PENDING_THIRD_PARTY',
      'RESOLVED',
      'CLOSED',
      'REOPENED',
      'CANCELLED',
    ].map((name) => [name, integer]),
  ),
};

/** Schéma de comptage ventilé par les 4 niveaux de priorité. */
const priorityCounts: SchemaObject = {
  type: 'object',
  properties: { LOW: integer, MEDIUM: integer, HIGH: integer, CRITICAL: integer },
};

/** Schéma de comptage ventilé par les 4 niveaux de sévérité. */
const severityCounts: SchemaObject = {
  type: 'object',
  properties: { S1: integer, S2: integer, S3: integer, S4: integer },
};

/**
 * Schémas OpenAPI Swagger exportés pour le tableau de bord principal.
 */
export const DASHBOARD_DOMAIN_SCHEMAS: Record<string, SchemaObject> = {
  DashboardOverview: {
    type: 'object',
    required: ['period', 'ticketVolume', 'byStatus', 'byPriority', 'bySeverity', 'sla'],
    properties: {
      period: { $ref: '#/components/schemas/DatePeriod' },
      ticketVolume: {
        type: 'object',
        required: ['total', 'openTickets', 'resolvedToday', 'createdToday'],
        properties: {
          total: { type: 'integer' },
          openTickets: { type: 'integer' },
          resolvedToday: { type: 'integer' },
          createdToday: { type: 'integer' },
        },
      },
      byStatus: statusCounts,
      byPriority: priorityCounts,
      bySeverity: severityCounts,
      sla: {
        type: 'object',
        required: ['totalTracked', 'breached', 'atRisk', 'compliant', 'complianceRate'],
        properties: {
          totalTracked: { type: 'integer' },
          breached: { type: 'integer' },
          atRisk: { type: 'integer' },
          compliant: { type: 'integer' },
          complianceRate: percentage,
        },
      },
    },
  },
  DashboardStatusSeries: {
    type: 'object',
    required: ['period', 'data'],
    properties: {
      period: { $ref: '#/components/schemas/DatePeriod' },
      data: {
        type: 'array',
        items: {
          type: 'object',
          required: ['status', 'count', 'avgAgeMinutes', 'percentage'],
          properties: {
            status: ticketStatus,
            count: { type: 'integer' },
            avgAgeMinutes: { type: 'integer' },
            percentage,
          },
        },
      },
    },
  },
  DashboardPrioritySeries: {
    type: 'object',
    required: ['period', 'data'],
    properties: {
      period: { $ref: '#/components/schemas/DatePeriod' },
      data: {
        type: 'array',
        items: {
          type: 'object',
          required: ['priority', 'count', 'slaBreaches', 'percentage'],
          properties: { priority, count: { type: 'integer' }, slaBreaches: { type: 'integer' }, percentage },
        },
      },
    },
  },
  DashboardDepartments: {
    type: 'object',
    required: ['period', 'data'],
    properties: {
      period: { $ref: '#/components/schemas/DatePeriod' },
      data: {
        type: 'array',
        items: {
          type: 'object',
          required: ['departmentId', 'total', 'open', 'resolved', 'closed', 'slaCompliant', 'slaBreached'],
          properties: {
            departmentId: uuid,
            departmentName: nullableString,
            total: { type: 'integer' },
            open: { type: 'integer' },
            resolved: { type: 'integer' },
            closed: { type: 'integer' },
            slaCompliant: { type: 'integer' },
            slaBreached: { type: 'integer' },
            avgResolutionMinutes: { type: 'number' },
          },
        },
      },
    },
  },
  DashboardWorkload: {
    type: 'object',
    required: ['generatedAt', 'data', 'summary'],
    properties: {
      generatedAt: dateTime,
      data: {
        type: 'array',
        items: {
          type: 'object',
          required: ['agentId', 'openTicketsCount', 'criticalTicketsCount', 'highTicketsCount', 'slaAtRiskCount'],
          properties: {
            agentId: uuid,
            firstName: nullableString,
            lastName: nullableString,
            email: nullableString,
            openTicketsCount: { type: 'integer' },
            criticalTicketsCount: { type: 'integer' },
            highTicketsCount: { type: 'integer' },
            slaAtRiskCount: { type: 'integer' },
          },
        },
      },
      summary: {
        type: 'object',
        required: ['totalAgents', 'totalOpenTickets', 'avgTicketsPerAgent', 'unassignedTickets'],
        properties: {
          totalAgents: { type: 'integer' },
          totalOpenTickets: { type: 'integer' },
          avgTicketsPerAgent: { type: 'number' },
          unassignedTickets: { type: 'integer' },
        },
      },
    },
  },
};
