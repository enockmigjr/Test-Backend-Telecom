import { readFileSync } from 'fs';
import { resolve } from 'path';

import { PUBLIC_SUPPORT_AUDIENCE, PUBLIC_SUPPORT_AUDIENCE_EXTENSION } from './public-support-api.decorator';

const METHODS = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'] as const;
const FORBIDDEN_TAGS = new Set(['users', 'departments', 'internal-notes', 'audit-logs', 'settings']);
const FORBIDDEN_SCHEMAS = /InternalNote|AuditLog|RefreshToken|IntegrationCredential/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function loadDocument(): Record<string, unknown> {
  const parsed: unknown = JSON.parse(readFileSync(resolve(process.cwd(), 'openapi.public.json'), 'utf8'));
  if (!isRecord(parsed)) throw new Error('openapi.public.json doit contenir un objet JSON.');
  return parsed;
}

function operation(document: Record<string, unknown>, path: string, method: string): Record<string, unknown> {
  const paths = document['paths'];
  if (!isRecord(paths) || !isRecord(paths[path]) || !isRecord(paths[path][method])) {
    throw new Error(`OpÃ©ration ${method.toUpperCase()} ${path} absente.`);
  }
  return paths[path][method];
}

function successSchema(value: Record<string, unknown>, status: string): Record<string, unknown> {
  const responses = value['responses'];
  if (!isRecord(responses) || !isRecord(responses[status])) throw new Error(`RÃ©ponse ${status} absente.`);
  const content = responses[status]['content'];
  if (!isRecord(content) || !isRecord(content['application/json'])) throw new Error('RÃ©ponse JSON absente.');
  const schema = content['application/json']['schema'];
  if (!isRecord(schema)) throw new Error('SchÃ©ma de rÃ©ponse absent.');
  return schema;
}

function component(document: Record<string, unknown>, name: string): Record<string, unknown> {
  const components = document['components'];
  if (!isRecord(components) || !isRecord(components['schemas']) || !isRecord(components['schemas'][name])) {
    throw new Error(`Composant ${name} absent.`);
  }
  return components['schemas'][name];
}

describe('contrat openapi.public.json', () => {
  const document = loadDocument();

  it('ne contient que des opérations explicitement marquées public-support', () => {
    expect(document).toHaveProperty('info.title', 'Telecom Public Support API');
    expect(document['security']).toBeUndefined();
    expect(isRecord(document['paths'])).toBe(true);
    if (!isRecord(document['paths'])) return;
    for (const path of Object.values(document['paths'])) {
      expect(isRecord(path)).toBe(true);
      if (!isRecord(path)) continue;
      for (const method of METHODS) {
        const operation = path[method];
        if (!isRecord(operation)) continue;
        expect(operation[PUBLIC_SUPPORT_AUDIENCE_EXTENSION]).toBe(PUBLIC_SUPPORT_AUDIENCE);
        const tags = Array.isArray(operation['tags']) ? operation['tags'] : [];
        expect(tags.some((tag) => typeof tag === 'string' && FORBIDDEN_TAGS.has(tag))).toBe(false);
      }
    }
  });

  it('n’expose aucun schéma ou mécanisme de sécurité interne', () => {
    const components = isRecord(document['components']) ? document['components'] : {};
    const schemas = isRecord(components['schemas']) ? Object.keys(components['schemas']) : [];
    const securitySchemes = isRecord(components['securitySchemes']) ? components['securitySchemes'] : {};
    expect(schemas.some((name) => FORBIDDEN_SCHEMAS.test(name))).toBe(false);
    expect(securitySchemes).not.toHaveProperty('bearer');
    expect(securitySchemes).toHaveProperty('publicSession');
    expect(securitySchemes).toHaveProperty('integrationAssertion');
  });

  it('publie la tranche phase 03 de création et de suivi', () => {
    const paths = isRecord(document['paths']) ? document['paths'] : {};
    expect(paths).toHaveProperty('/api/v1/public-support/catalog');
    expect(paths).toHaveProperty('/api/v1/public-support/conversations');
    expect(paths).toHaveProperty('/api/v1/public-support/conversations/{id}');
    expect(paths).toHaveProperty('/api/v1/public-support/conversations/{id}/confirm');
    expect(paths).toHaveProperty('/api/v1/public-support/conversations/{id}/handoff');
    expect(paths).toHaveProperty('/api/v1/public-support/tickets');
    expect(paths).toHaveProperty('/api/v1/public-support/tickets/{id}');
    expect(paths).toHaveProperty('/api/v1/public-support/tickets/{id}/timeline');
    expect(paths).toHaveProperty('/api/v1/public-support/tickets/{id}/comments');
    expect(paths).toHaveProperty('/api/v1/public-support/preferences');
    expect(paths).toHaveProperty('/api/v1/public-support/tickets/{ticketId}/attachments');
    expect(paths).toHaveProperty('/api/v1/public-support/tickets/{ticketId}/attachments/{attachmentId}/status');
    expect(paths).toHaveProperty('/api/v1/public-support/tickets/{ticketId}/attachments/{attachmentId}/download');
    expect(paths).toHaveProperty('/api/v1/public-support/conversations/{conversationId}/attachments');
    expect(paths).toHaveProperty('/api/v1/public-support/config');
    expect(paths).toHaveProperty('/api/v1/public-support/session/devices');
    expect(paths).toHaveProperty('/api/v1/public-support/session/devices/{id}');
  });

  it('type explicitement les donnees de chaque reponse publique JSON', () => {
    const expected = [
      ['/api/v1/public-support/catalog', 'get', '200', 'PublicCatalogResponseDto'],
      ['/api/v1/public-support/config', 'get', '200', 'PublicIntegrationConfigResponseDto'],
      ['/api/v1/public-support/conversations', 'post', '201', 'PublicConversationStateResponseDto'],
      ['/api/v1/public-support/conversations/{id}', 'get', '200', 'PublicConversationDetailResponseDto'],
      ['/api/v1/public-support/conversations/{id}/draft', 'patch', '200', 'PublicDraftSavedResponseDto'],
      ['/api/v1/public-support/conversations/{id}/confirm', 'post', '201', 'PublicTicketConfirmedResponseDto'],
      ['/api/v1/public-support/conversations/{id}/handoff', 'post', '201', 'PublicHandoffResponseDto'],
      ['/api/v1/public-support/tickets', 'get', '200', 'PublicTicketListResponseDto'],
      ['/api/v1/public-support/tickets/{id}', 'get', '200', 'PublicTicketDetailResponseDto'],
      ['/api/v1/public-support/tickets/{id}/timeline', 'get', '200', 'PublicTimelineResponseDto'],
      ['/api/v1/public-support/tickets/{id}/comments', 'post', '201', 'PublicCommentResponseDto'],
      ['/api/v1/public-support/preferences', 'get', '200', 'PublicPreferencesResponseDto'],
      ['/api/v1/public-support/preferences', 'patch', '200', 'PublicPreferencesResponseDto'],
      ['/api/v1/public-support/identity/email/request', 'post', '201', 'VerificationRequestResponseDto'],
      ['/api/v1/public-support/identity/assertion/exchange', 'post', '201', 'PublicSessionResponseDto'],
      ['/api/v1/public-support/session/bootstrap/request', 'post', '201', 'BootstrapGrantResponseDto'],
      ['/api/v1/public-support/session/bootstrap/consume', 'post', '201', 'PublicSessionResponseDto'],
      ['/api/v1/public-support/session/restore', 'post', '201', 'PublicSessionResponseDto'],
      ['/api/v1/public-support/session/revoke-device', 'post', '201', 'DeviceRevokedResponseDto'],
      ['/api/v1/public-support/session/devices', 'get', '200', 'TrustedDeviceListResponseDto'],
      ['/api/v1/public-support/session/devices/{id}', 'delete', '200', 'DeviceRevokedResponseDto'],
      ['/api/v1/public-support/tickets/{ticketId}/attachments', 'get', '200', 'PublicAttachmentListResponseDto'],
      ['/api/v1/public-support/tickets/{ticketId}/attachments', 'post', '201', 'PublicAttachmentResponseDto'],
      [
        '/api/v1/public-support/tickets/{ticketId}/attachments/{attachmentId}/status',
        'get',
        '200',
        'PublicAttachmentResponseDto',
      ],
      [
        '/api/v1/public-support/conversations/{conversationId}/attachments',
        'get',
        '200',
        'PublicAttachmentListResponseDto',
      ],
      [
        '/api/v1/public-support/conversations/{conversationId}/attachments',
        'post',
        '201',
        'PublicAttachmentResponseDto',
      ],
      [
        '/api/v1/public-support/conversations/{conversationId}/attachments/{attachmentId}/status',
        'get',
        '200',
        'PublicAttachmentResponseDto',
      ],
    ] as const;
    for (const [path, method, status, schemaName] of expected) {
      expect(successSchema(operation(document, path, method), status)).toEqual({
        $ref: `#/components/schemas/${schemaName}`,
      });
      const response = component(document, schemaName);
      expect(response).toHaveProperty('properties.data');
      expect(response).not.toHaveProperty('properties.data.additionalProperties', true);
    }

    const consume = successSchema(operation(document, '/api/v1/public-support/identity/email/consume', 'post'), '201');
    expect(consume['oneOf']).toEqual([
      { $ref: '#/components/schemas/PublicSessionResponseDto' },
      { $ref: '#/components/schemas/VerificationRejectedResponseDto' },
    ]);
    expect(component(document, 'VerificationRejectedDataDto')).toHaveProperty('properties.verified.type', 'boolean');
    expect(component(document, 'VerificationRejectedResponseDto')).toHaveProperty('properties.success.type', 'boolean');
  });

  it('declare le fichier binaire requis des deux uploads multipart', () => {
    const paths = [
      '/api/v1/public-support/tickets/{ticketId}/attachments',
      '/api/v1/public-support/conversations/{conversationId}/attachments',
    ];
    for (const path of paths) {
      const upload = operation(document, path, 'post');
      expect(upload).toHaveProperty('requestBody.required', true);
      expect(upload).toHaveProperty('requestBody.content.multipart/form-data.schema.required', ['file']);
      expect(upload).toHaveProperty('requestBody.content.multipart/form-data.schema.properties.file', {
        type: 'string',
        format: 'binary',
      });
      expect(upload).toHaveProperty(
        'parameters',
        expect.arrayContaining([
          expect.objectContaining({
            in: 'header',
            name: 'Idempotency-Key',
            required: true,
          }),
        ]),
      );
    }
  });

  it('déclare uniquement un flux binaire pour les téléchargements de pièces jointes', () => {
    const paths = [
      '/api/v1/public-support/tickets/{ticketId}/attachments/{attachmentId}/download',
      '/api/v1/public-support/conversations/{conversationId}/attachments/{attachmentId}/download',
    ];
    for (const path of paths) {
      const download = operation(document, path, 'get');
      const responses = isRecord(download['responses']) ? download['responses'] : {};
      const response = isRecord(responses['200']) ? responses['200'] : {};
      const content = isRecord(response['content']) ? response['content'] : {};
      expect(Object.keys(content)).toEqual(['application/octet-stream']);
    }
  });

  it('aligne les paramètres facultatifs et les headers réellement requis', () => {
    const tickets = operation(document, '/api/v1/public-support/tickets', 'get');
    expect(tickets).toHaveProperty(
      'parameters',
      expect.arrayContaining([
        expect.objectContaining({ in: 'query', name: 'page', required: false }),
        expect.objectContaining({ in: 'query', name: 'limit', required: false }),
      ]),
    );
    const restore = operation(document, '/api/v1/public-support/session/restore', 'post');
    expect(restore).toHaveProperty(
      'parameters',
      expect.arrayContaining([
        expect.objectContaining({ in: 'header', name: 'x-trusted-device', required: true }),
        expect.objectContaining({ in: 'header', name: 'x-integration-key', required: true }),
      ]),
    );
  });
});
