/**
 * ============================================================================
 * FICHIER : src/common/openapi/report-domain.schemas.ts
 * RÔLE : Définitions OpenAPI Swagger pour le domaine de génération des rapports PDF et statistiques.
 * EXPLICATION :
 * Ce module contient les schémas JSON Schema pour Swagger UI décrivant les entités de rapports :
 * 1. `Report` & `ReportJob` : État d'avancement des tâches de génération asynchrone (BullMQ worker + stockage S3/MinIO).
 * 2. `TicketReport` : Structure détaillée d'un rapport d'incident individuel exporté au format PDF.
 * 3. `SlaReport` : Rapport synthétique de conformité SLA pour les décideurs.
 * 4. `DatePeriod` : Période temporelle de filtrage (`from` à `to`).
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

/**
 * Schémas OpenAPI Swagger exportés pour les rapports.
 */
export const REPORT_DOMAIN_SCHEMAS: Record<string, SchemaObject> = {
  Report: {
    type: 'object',
    required: ['id', 'type', 'status', 'requestedBy', 'createdAt'],
    properties: {
      id: uuid,
      type: { type: 'string', enum: ['ticket-report', 'sla-report', 'weekly-report'] },
      status: { type: 'string', enum: ['pending', 'completed', 'failed'] },
      objectKey: nullableString,
      requestedBy: uuid,
      errorMessage: nullableString,
      metadata: jsonValue,
      createdAt: dateTime,
      completedAt: nullableDateTime,
    },
  },
  ReportJob: {
    type: 'object',
    required: ['message', 'reportId'],
    properties: { message: { type: 'string' }, reportId: uuid },
  },
  TicketReport: {
    type: 'object',
    required: ['generatedAt', 'type', 'ticket'],
    properties: {
      generatedAt: dateTime,
      type: { type: 'string', enum: ['ticket-report'] },
      ticket: {
        type: 'object',
        required: ['id', 'ticketNumber', 'title', 'description', 'status', 'priority', 'severity', 'createdAt'],
        properties: {
          id: uuid,
          ticketNumber: { type: 'string' },
          title: { type: 'string' },
          description: { type: 'string' },
          status: ticketStatus,
          priority,
          severity,
          category: nullableString,
          createdAt: dateTime,
          resolvedAt: nullableDateTime,
          closedAt: nullableDateTime,
          customerName: nullableString,
          resolutionSummary: nullableString,
          departmentName: nullableString,
        },
      },
    },
  },
  SlaReport: {
    type: 'object',
    required: ['generatedAt', 'type', 'period', 'summary', 'byPriority'],
    properties: {
      generatedAt: dateTime,
      type: { type: 'string', enum: ['sla-report'] },
      period: { $ref: '#/components/schemas/DatePeriod' },
      summary: {
        type: 'object',
        required: ['total', 'breached', 'avgResolutionMinutes'],
        properties: {
          total: { type: 'integer' },
          breached: { type: 'integer' },
          avgResolutionMinutes: { type: 'integer' },
        },
      },
      byPriority: {
        type: 'array',
        items: {
          type: 'object',
          required: ['priority', 'count', 'breached'],
          properties: { priority, count: { type: 'integer' }, breached: { type: 'integer' } },
        },
      },
    },
  },
  DatePeriod: {
    type: 'object',
    required: ['from', 'to'],
    properties: { from: dateTime, to: dateTime },
  },
};
