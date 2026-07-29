/**
 * ============================================================================
 * FICHIER : src/common/openapi/openapi-document.completer.spec.ts
 * RÔLE : Suite de tests unitaires pour le composant openapi-document.completer.
 * EXPLICATION :
 * Ce fichier contient les tests automatisés validant le comportement et l'intégrité de openapi-document.completer.
 * 1. Vérifie le fonctionnement nominal et les cas d'erreur.
 * 2. Garantit qu'aucune régression n'est introduite lors des évolutions du code.
 * ============================================================================
 */

import { OpenAPIObject } from '@nestjs/swagger';

import { completeOpenApiDocument } from './openapi-document.completer';

function fixture(): OpenAPIObject {
  return {
    openapi: '3.0.0',
    info: { title: 'Test', version: '1' },
    paths: {
      '/items': {
        get: {
          summary: 'Liste paginée',
          operationId: 'listItems',
          parameters: [],
          responses: { 200: { description: 'Liste paginée.' }, 401: { description: 'Non authentifié.' } },
        },
      },
      '/items/{id}': {
        delete: { operationId: 'deleteItem', parameters: [], responses: { 204: { description: 'Supprimé.' } } },
      },
      '/reports/{id}/download': {
        get: { operationId: 'downloadReport', parameters: [], responses: { 200: { description: 'Fichier PDF.' } } },
      },
      '/attachments/{id}/download': {
        get: { operationId: 'downloadAttachment', parameters: [], responses: { 200: { description: 'Fichier.' } } },
      },
    },
  };
}

describe('completeOpenApiDocument', () => {
  /** Test : ajoute les enveloppes succès, erreur et pagination */
  it('ajoute les enveloppes succès, erreur et pagination', () => {
    const document = completeOpenApiDocument(fixture());
    const list = document.paths['/items'].get;

    expect(list?.responses['200']).toEqual(
      expect.objectContaining({
        content: {
          'application/json': { schema: { $ref: '#/components/schemas/ApiPaginatedResponse' } },
        },
      }),
    );
    expect(list?.responses['401']).toEqual(
      expect.objectContaining({
        content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } },
      }),
    );
    expect(list?.responses.default).toBeDefined();
  });

  /** Test : préserve 204 sans contenu et documente les téléchargements binaires */

  it('préserve 204 sans contenu et documente les téléchargements binaires', () => {
    const document = completeOpenApiDocument(fixture());
    expect(document.paths['/items/{id}'].delete?.responses['204']).not.toHaveProperty('content');
    expect(document.paths['/reports/{id}/download'].get?.responses['200']).toEqual(
      expect.objectContaining({
        content: { 'application/pdf': { schema: { type: 'string', format: 'binary' } } },
      }),
    );
    expect(document.paths['/attachments/{id}/download'].get?.responses['200']).toEqual(
      expect.objectContaining({
        content: { 'application/octet-stream': { schema: { type: 'string', format: 'binary' } } },
      }),
    );
  });
});
