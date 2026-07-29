/**
 * ============================================================================
 * FICHIER : src/common/openapi/openapi.schemas.ts
 * RÔLE : Registre central des schémas d'enveloppe HTTP et modèles métier OpenAPI Swagger.
 * EXPLICATION :
 * Ce fichier fusionne l'ensemble des définitions de schémas Swagger réutilisables :
 * 1. Intègre les sous-schémas par domaine (`CORE`, `TICKET`, `COLLABORATION`, `DASHBOARD`, `REPORT`).
 * 2. Définit les schémas d'enveloppe standardisés :
 *    - `ApiSuccessResponse` : Enveloppe de réponse de succès générique `{ success: true, data }`.
 *    - `PaginationMeta` & `ApiPaginatedResponse` : Métadonnées et liste paginée `{ page, limit, total, totalPages }`.
 *    - `ApiCollectionResponse` : Liste simple non paginée.
 *    - `ApiErrorResponse` & `ApiErrorDetail` : Structure standard d'erreur HTTP `{ success: false, error: { code, message, correlationId, timestamp } }`.
 * ============================================================================
 */

import { SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';
import { COLLABORATION_DOMAIN_SCHEMAS } from './collaboration-domain.schemas';
import { CORE_DOMAIN_SCHEMAS } from './core-domain.schemas';
import { DASHBOARD_DOMAIN_SCHEMAS } from './dashboard-domain.schemas';
import { DASHBOARD_SLA_SCHEMAS } from './dashboard-sla.schemas';
import { REPORT_DOMAIN_SCHEMAS } from './report-domain.schemas';
import { TICKET_DOMAIN_SCHEMAS } from './ticket-domain.schemas';

/**
 * Registre global des schémas OpenAPI référencés par `$ref: '#/components/schemas/...'`.
 */
export const OPENAPI_SCHEMAS: Record<string, SchemaObject> = {
  ...CORE_DOMAIN_SCHEMAS,
  ...TICKET_DOMAIN_SCHEMAS,
  ...COLLABORATION_DOMAIN_SCHEMAS,
  ...DASHBOARD_DOMAIN_SCHEMAS,
  ...DASHBOARD_SLA_SCHEMAS,
  ...REPORT_DOMAIN_SCHEMAS,
  ApiSuccessResponse: {
    type: 'object',
    required: ['success', 'statusCode', 'data'],
    properties: {
      success: { type: 'boolean', enum: [true] },
      statusCode: { type: 'integer', minimum: 200, maximum: 299 },
      message: { type: 'string' },
      data: { nullable: true },
    },
  },
  PaginationMeta: {
    type: 'object',
    required: ['page', 'limit', 'total', 'totalPages'],
    properties: {
      page: { type: 'integer', minimum: 1 },
      limit: { type: 'integer', minimum: 1, maximum: 100 },
      total: { type: 'integer', minimum: 0 },
      totalPages: { type: 'integer', minimum: 0 },
    },
  },
  ApiPaginatedResponse: {
    type: 'object',
    required: ['success', 'statusCode', 'data', 'meta'],
    properties: {
      success: { type: 'boolean', enum: [true] },
      statusCode: { type: 'integer', minimum: 200, maximum: 299 },
      data: { type: 'array', items: { type: 'object', additionalProperties: true } },
      meta: { $ref: '#/components/schemas/PaginationMeta' },
    },
  },
  ApiCollectionResponse: {
    type: 'object',
    required: ['success', 'statusCode', 'data'],
    properties: {
      success: { type: 'boolean', enum: [true] },
      statusCode: { type: 'integer', minimum: 200, maximum: 299 },
      data: { type: 'array', items: { type: 'object', additionalProperties: true } },
    },
  },
  ApiErrorDetail: {
    type: 'object',
    required: ['message'],
    properties: {
      field: { type: 'string' },
      message: { type: 'string' },
      code: { type: 'string' },
    },
  },
  ApiErrorResponse: {
    type: 'object',
    required: ['success', 'error'],
    properties: {
      success: { type: 'boolean', enum: [false] },
      error: {
        type: 'object',
        required: ['code', 'message', 'correlationId', 'timestamp'],
        properties: {
          code: { type: 'string' },
          message: { type: 'string' },
          details: {
            oneOf: [
              { type: 'array', items: { $ref: '#/components/schemas/ApiErrorDetail' } },
              { type: 'object', additionalProperties: true },
            ],
          },
          correlationId: { type: 'string', format: 'uuid' },
          timestamp: { type: 'string', format: 'date-time' },
        },
      },
    },
  },
};
