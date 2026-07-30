import { OpenAPIObject } from '@nestjs/swagger';

import { PUBLIC_SUPPORT_AUDIENCE, PUBLIC_SUPPORT_AUDIENCE_EXTENSION } from './public-support-api.decorator';
import { projectPublicOpenApi } from './public-openapi';

type OperationObject = NonNullable<OpenAPIObject['paths'][string]['get']>;

function publicOperation(operationId: string, schema: string): OperationObject {
  return Object.assign(
    {
      operationId,
      tags: ['public-support'],
      security: [{ publicSession: [] }],
      servers: [{ url: 'http://nest-internal:3000' }],
      responses: {
        200: {
          description: 'Succès.',
          content: { 'application/json': { schema: { $ref: `#/components/schemas/${schema}` } } },
          links: {
            details: {
              operationId: 'getPublicTicket',
              server: { url: 'http://nest-link-internal:3000' },
            },
          },
        },
      },
    },
    { [PUBLIC_SUPPORT_AUDIENCE_EXTENSION]: PUBLIC_SUPPORT_AUDIENCE },
  );
}

function fixture(): OpenAPIObject {
  const listOperation = publicOperation('listPublicTickets', 'PublicTicketList');
  listOperation.callbacks = { status: { $ref: '#/components/callbacks/TicketStatusCallback' } };
  return {
    openapi: '3.0.0',
    info: { title: 'Interne', version: '1' },
    servers: [{ url: 'http://nest-internal:3000' }],
    security: [{ bearer: [] }],
    tags: [{ name: 'public-support' }, { name: 'internal-notes' }],
    paths: {
      '/public/tickets': { get: listOperation, servers: [{ url: 'http://nest-path:3000' }] },
      '/internal-notes': {
        get: { operationId: 'listInternalNotes', responses: { 200: { description: 'Interne.' } } },
      },
    },
    components: {
      securitySchemes: {
        bearer: { type: 'http', scheme: 'bearer' },
        publicSession: { type: 'http', scheme: 'bearer' },
        callbackToken: { type: 'apiKey', name: 'X-Callback-Token', in: 'header' },
      },
      schemas: {
        PublicTicketList: { type: 'array', items: { $ref: '#/components/schemas/PublicTicket' } },
        PublicTicket: { type: 'object', properties: { id: { type: 'string' } } },
        InternalNote: { type: 'object', properties: { content: { type: 'string' } } },
      },
      callbacks: {
        TicketStatusCallback: {
          '{$request.body#/callbackUrl}': {
            servers: [{ url: 'http://nest-callback-path:3000' }],
            post: {
              security: [{ callbackToken: [] }],
              servers: [{ url: 'http://nest-callback-operation:3000' }],
              responses: { 204: { description: 'Reçu.' } },
            },
          },
        },
      },
    },
  };
}

describe('projectPublicOpenApi', () => {
  it('conserve uniquement les opérations explicitement publiques', () => {
    const projected = projectPublicOpenApi(fixture());
    expect(projected.paths).toHaveProperty('/public/tickets.get.operationId', 'listPublicTickets');
    expect(projected.paths).not.toHaveProperty('/internal-notes');
    expect(projected.security).toBeUndefined();
    expect(projected.servers).toBeUndefined();
    expect(projected.paths['/public/tickets'].servers).toBeUndefined();
    expect(projected.paths['/public/tickets'].get?.servers).toBeUndefined();
    expect(JSON.stringify(projected)).not.toContain('nest-');
    expect(JSON.stringify(projected)).not.toContain('"servers"');
    expect(JSON.stringify(projected)).not.toContain('"server"');
  });

  it('conserve seulement les composants transitivement référencés', () => {
    const projected = projectPublicOpenApi(fixture());
    expect(projected).toHaveProperty('components.schemas.PublicTicketList');
    expect(projected).toHaveProperty('components.schemas.PublicTicket');
    expect(projected).toHaveProperty('components.securitySchemes.publicSession');
    expect(projected).toHaveProperty('components.securitySchemes.callbackToken');
    expect(projected).toHaveProperty('components.callbacks.TicketStatusCallback');
    expect(projected).not.toHaveProperty('components.schemas.InternalNote');
    expect(projected).not.toHaveProperty('components.securitySchemes.bearer');
    expect(projected.tags).toEqual([{ name: 'public-support' }]);
  });

  it('refuse une opération publique sans sécurité explicite', () => {
    const document = fixture();
    const operation = document.paths['/public/tickets'].get;
    if (operation) delete operation.security;
    expect(() => projectPublicOpenApi(document)).toThrow('Sécurité OpenAPI explicite requise');

    const undefinedSecurity = fixture();
    const secondOperation = undefinedSecurity.paths['/public/tickets'].get;
    if (secondOperation) secondOperation.security = undefined;
    expect(() => projectPublicOpenApi(undefinedSecurity)).toThrow('Sécurité OpenAPI explicite requise');
  });
});
