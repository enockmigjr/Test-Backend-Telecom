/**
 * ============================================================================
 * FICHIER : src/common/openapi/openapi.contract.spec.ts
 * RÔLE : Suite de tests unitaires pour le composant openapi.contract.
 * EXPLICATION :
 * Ce fichier contient les tests automatisés validant le comportement et l'intégrité de openapi.contract.
 * 1. Vérifie le fonctionnement nominal et les cas d'erreur.
 * 2. Garantit qu'aucune régression n'est introduite lors des évolutions du code.
 * ============================================================================
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { RELEASE_RESPONSE_MODELS } from './response-model.map';

const METHODS = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head'] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function loadDocument(): Record<string, unknown> {
  const parsed: unknown = JSON.parse(readFileSync(resolve(process.cwd(), 'openapi.json'), 'utf8'));
  if (!isRecord(parsed)) throw new Error('openapi.json doit contenir un objet JSON.');
  return parsed;
}

function operations(document: Record<string, unknown>): Record<string, unknown>[] {
  if (!isRecord(document['paths'])) throw new Error('OpenAPI paths manquant.');
  const result: Record<string, unknown>[] = [];
  for (const pathItem of Object.values(document['paths'])) {
    if (!isRecord(pathItem)) continue;
    for (const method of METHODS) {
      const operation = pathItem[method];
      if (isRecord(operation)) result.push(operation);
    }
  }
  return result;
}

function hasSchema(response: unknown): boolean {
  if (!isRecord(response) || !isRecord(response['content'])) return false;
  return Object.values(response['content']).some(
    (media) => isRecord(media) && isRecord(media['schema']) && Object.keys(media['schema']).length > 0,
  );
}

function jsonSuccessSchema(operation: Record<string, unknown>): Record<string, unknown> | null {
  if (!isRecord(operation['responses'])) return null;
  for (const [status, response] of Object.entries(operation['responses'])) {
    if (!/^2\d\d$/.test(status) || status === '204' || !isRecord(response) || !isRecord(response['content'])) continue;
    const media = response['content']['application/json'];
    if (isRecord(media) && isRecord(media['schema'])) return media['schema'];
  }
  return null;
}

function componentNames(document: Record<string, unknown>): Set<string> {
  const components = document['components'];
  if (!isRecord(components) || !isRecord(components['schemas'])) return new Set();
  return new Set(Object.keys(components['schemas']));
}

function successMediaTypes(operation: Record<string, unknown>): string[] {
  if (!isRecord(operation['responses'])) return [];
  for (const [status, response] of Object.entries(operation['responses'])) {
    if (/^2\d\d$/.test(status) && status !== '204' && isRecord(response) && isRecord(response['content'])) {
      return Object.keys(response['content']);
    }
  }
  return [];
}

describe('contrat openapi.json', () => {
  const document = loadDocument();
  const apiOperations = operations(document);

  /** Test : contient les 99 opérations actuelles avec des operationId uniques */

  it('contient les 110 opérations actuelles avec des operationId uniques', () => {
    const operationIds = apiOperations.map((operation) => operation['operationId']);
    expect(apiOperations).toHaveLength(110);
    expect(operationIds.every((id) => typeof id === 'string' && id.length > 0)).toBe(true);
    expect(new Set(operationIds).size).toBe(operationIds.length);
  });

  /** Test : documente chaque réponse JSON 2xx et chaque erreur déclarée */

  it('documente chaque réponse JSON 2xx et chaque erreur déclarée', () => {
    for (const operation of apiOperations) {
      expect(isRecord(operation['responses'])).toBe(true);
      if (!isRecord(operation['responses'])) continue;
      for (const [status, response] of Object.entries(operation['responses'])) {
        if (/^2\d\d$/.test(status) && status !== '204') expect(hasSchema(response)).toBe(true);
        if (/^[45]\d\d$/.test(status)) expect(hasSchema(response)).toBe(true);
      }
      expect(hasSchema(operation['responses']['default'])).toBe(true);
    }
  });

  /** Test : publie les enveloppes communes nécessaires au client typé */

  it('publie les enveloppes communes nécessaires au client typé', () => {
    expect(document).toHaveProperty('components.schemas.ApiSuccessResponse');
    expect(document).toHaveProperty('components.schemas.ApiCollectionResponse');
    expect(document).toHaveProperty('components.schemas.ApiPaginatedResponse');
    expect(document).toHaveProperty('components.schemas.ApiErrorResponse');
    expect(document).toHaveProperty('components.schemas.PaginationMeta');
  });

  /** Test : utilise un modèle métier explicite pour chaque opération Release 1 */

  it('utilise un modèle métier explicite pour chaque opération Release 1', () => {
    const byId = new Map(apiOperations.map((operation) => [operation['operationId'], operation]));
    const schemas = componentNames(document);

    for (const [operationId, model] of Object.entries(RELEASE_RESPONSE_MODELS)) {
      const operation = byId.get(operationId);
      expect(operation).toBeDefined();
      if (!operation) continue;
      const responseSchema = jsonSuccessSchema(operation);
      expect(responseSchema).not.toBeNull();
      if (!responseSchema) continue;

      expect(responseSchema['$ref']).toBeUndefined();
      expect(responseSchema['additionalProperties']).toBeUndefined();
      if (model.kind.endsWith('action')) {
        expect(responseSchema).toHaveProperty('properties.message.type', 'string');
        continue;
      }

      expect(model.schema && schemas.has(model.schema)).toBe(true);
      const properties = responseSchema['properties'];
      expect(isRecord(properties)).toBe(true);
      if (!isRecord(properties) || !isRecord(properties['data'])) continue;
      expect(properties['data']['additionalProperties']).toBeUndefined();
      if (model.kind === 'item') {
        expect(properties['data']['$ref']).toBe(`#/components/schemas/${model.schema}`);
      } else {
        expect(properties['data']).toHaveProperty('type', 'array');
        expect(properties['data']).toHaveProperty('items.$ref', `#/components/schemas/${model.schema}`);
      }
    }
  });

  /** Test : reste fidèle aux enums, enveloppes et types binaires runtime */

  it('reste fidèle aux enums, enveloppes et types binaires runtime', () => {
    const byId = new Map(apiOperations.map((operation) => [operation['operationId'], operation]));
    expect(document).toHaveProperty('components.schemas.Ticket.properties.severity.enum', ['S1', 'S2', 'S3', 'S4']);

    const ticketDetail = byId.get('TicketsController_findOne');
    expect(ticketDetail && jsonSuccessSchema(ticketDetail)).toHaveProperty(
      'properties.data.$ref',
      '#/components/schemas/Ticket',
    );

    const attachment = byId.get('AttachmentsController_download');
    const report = byId.get('ReportsController_downloadReport');
    const publicReport = byId.get('PublicReportsController_download');
    expect(attachment && successMediaTypes(attachment)).toEqual(['application/octet-stream']);
    expect(report && successMediaTypes(report)).toEqual(['application/pdf']);
    expect(publicReport && successMediaTypes(publicReport)).toEqual(['application/pdf']);
  });
});
