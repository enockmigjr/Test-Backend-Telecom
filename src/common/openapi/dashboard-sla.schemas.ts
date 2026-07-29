/**
 * ============================================================================
 * FICHIER : src/common/openapi/dashboard-sla.schemas.ts
 * RÔLE : Définitions OpenAPI Swagger pour le suivi des SLA et temps de résolution.
 * EXPLICATION :
 * Ce module répertorie les schémas Swagger décrivant les performances SLA et temporelles :
 * 1. `DashboardSlaCompliance` : Taux global de conformité SLA (première réponse & résolution), ventilation par priorité et catégorie.
 * 2. `DashboardResolutionTime` : Métriques de temps de résolution (moyenne, médiane, centile P90) et tendance temporelle.
 * ============================================================================
 */

import { SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';

import { priority } from './schema-helpers';

/** Propriétés communes réutilisables pour le suivi de conformité SLA. */
const complianceFields: Record<string, SchemaObject> = {
  totalTracked: { type: 'integer' },
  compliant: { type: 'integer' },
  breached: { type: 'integer' },
  complianceRate: { type: 'number', minimum: 0, maximum: 100 },
};

/**
 * Schémas OpenAPI Swagger exportés pour les rapports SLA et de résolution.
 */
export const DASHBOARD_SLA_SCHEMAS: Record<string, SchemaObject> = {
  DashboardSlaCompliance: {
    type: 'object',
    required: ['period', 'summary', 'byPriority', 'byCategory'],
    properties: {
      period: { $ref: '#/components/schemas/DatePeriod' },
      summary: {
        type: 'object',
        required: ['totalTracked', 'compliant', 'breached', 'atRisk', 'complianceRate', 'firstResponseComplianceRate'],
        properties: {
          ...complianceFields,
          atRisk: { type: 'integer' },
          firstResponseComplianceRate: { type: 'number', minimum: 0, maximum: 100 },
        },
      },
      byPriority: {
        type: 'array',
        items: { type: 'object', required: ['priority'], properties: { priority, ...complianceFields } },
      },
      byCategory: {
        type: 'array',
        items: {
          type: 'object',
          required: ['category'],
          properties: { category: { type: 'string' }, ...complianceFields },
        },
      },
    },
  },
  DashboardResolutionTime: {
    type: 'object',
    required: ['period', 'overall', 'trend'],
    properties: {
      period: { $ref: '#/components/schemas/DatePeriod' },
      overall: {
        type: 'object',
        required: ['avgResolutionTimeMinutes', 'medianResolutionTimeMinutes', 'p90ResolutionTimeMinutes'],
        properties: {
          avgResolutionTimeMinutes: { type: 'integer' },
          medianResolutionTimeMinutes: { type: 'integer' },
          p90ResolutionTimeMinutes: { type: 'integer' },
        },
      },
      trend: {
        type: 'array',
        items: {
          type: 'object',
          required: ['period', 'avgResolutionTimeMinutes'],
          properties: {
            period: { type: 'string', format: 'date-time' },
            avgResolutionTimeMinutes: { type: 'number', minimum: 0 },
          },
        },
      },
    },
  },
};
