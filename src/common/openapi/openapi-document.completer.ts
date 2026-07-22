import { OpenAPIObject } from '@nestjs/swagger';
import {
  OperationObject,
  ReferenceObject,
  ResponseObject,
  SchemaObject,
} from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';

import { OPENAPI_SCHEMAS } from './openapi.schemas';
import { businessEnvelope } from './business-envelope.schema';
import { RELEASE_RESPONSE_MODELS } from './response-model.map';

const METHODS = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head'] as const;

function isReference(value: ResponseObject | ReferenceObject): value is ReferenceObject {
  return '$ref' in value;
}

function isPaginated(operation: OperationObject, response: ResponseObject): boolean {
  const text = `${operation.summary ?? ''} ${operation.description ?? ''} ${response.description}`.toLowerCase();
  const queryNames = (operation.parameters ?? [])
    .filter((parameter): parameter is Exclude<typeof parameter, ReferenceObject> => !('$ref' in parameter))
    .filter((parameter) => parameter.in === 'query')
    .map((parameter) => parameter.name);
  return text.includes('pagin') || (queryNames.includes('page') && queryNames.includes('limit'));
}

function successSchema(operation: OperationObject, response: ResponseObject): SchemaObject | ReferenceObject {
  const text = `${operation.summary ?? ''} ${response.description}`.toLowerCase();
  const schemaName = isPaginated(operation, response)
    ? 'ApiPaginatedResponse'
    : text.includes('liste')
      ? 'ApiCollectionResponse'
      : 'ApiSuccessResponse';
  return { $ref: `#/components/schemas/${schemaName}` };
}

function ensureResponseSchema(path: string, operation: OperationObject, status: string): void {
  const candidate = operation.responses[status];
  if (!candidate || isReference(candidate) || status === '204') return;

  candidate.content ??= {};

  if (path.endsWith('/metrics')) {
    candidate.content['text/plain'] = { schema: { type: 'string' } };
    return;
  }

  const isBinary = path.endsWith('/download') || candidate.description.toLowerCase().includes('fichier pdf');
  if (isBinary) {
    const mediaType = path.includes('/reports/') ? 'application/pdf' : 'application/octet-stream';
    candidate.content[mediaType] = { schema: { type: 'string', format: 'binary' } };
    return;
  }

  const isSuccess = /^2\d\d$/.test(status);
  const responseModel = operation.operationId ? RELEASE_RESPONSE_MODELS[operation.operationId] : undefined;
  if (isSuccess && responseModel) {
    candidate.content['application/json'] = { schema: businessEnvelope(responseModel) };
    return;
  }
  if (Object.values(candidate.content).some((media) => media.schema)) return;

  candidate.content['application/json'] = {
    schema: isSuccess ? successSchema(operation, candidate) : { $ref: '#/components/schemas/ApiErrorResponse' },
  };
}

function completeOperation(path: string, operation: OperationObject): void {
  for (const status of Object.keys(operation.responses)) {
    ensureResponseSchema(path, operation, status);
  }
  operation.responses.default ??= {
    description: 'Erreur standardisée.',
    content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } },
  };
}

export function completeOpenApiDocument(document: OpenAPIObject): OpenAPIObject {
  document.components ??= {};
  document.components.schemas = { ...document.components.schemas, ...OPENAPI_SCHEMAS };

  for (const [path, pathItem] of Object.entries(document.paths)) {
    for (const method of METHODS) {
      const operation = pathItem[method];
      if (operation) completeOperation(path, operation);
    }
  }
  return document;
}
