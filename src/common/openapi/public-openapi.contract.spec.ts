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
});
