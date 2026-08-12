/**
 * ============================================================================
 * FICHIER : src/common/openapi/openapi-document.completer.ts
 * RÔLE : Post-processeur et compléteur de la spécification OpenAPI / Swagger.
 * EXPLICATION :
 * Ce composant parcourt l'ensemble des routes et opérations du document Swagger pour :
 * 1. Injecter les schémas de données globaux (`OPENAPI_SCHEMAS` : enveloppes de succès, pagination, erreurs).
 * 2. Associer aux réponses HTTP les types MIME appropriés (`application/json`, `text/plain` pour les métriques Prometheus, `application/pdf` pour les rapports).
 * 3. Envelopper les modèles de retour DTO dans le contrat d'enveloppe métier `businessEnvelope(model)`.
 * 4. S'assurer qu'une réponse `default` standardisée d'erreur (`ApiErrorResponse`) est présente sur chaque route.
 * ============================================================================
 */

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
import { isRecord } from '../utils/helpers';

/** Liste immuable des méthodes HTTP supportées par la spécification OpenAPI. */
const METHODS = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head'] as const;

/** Prédicat TypeScript vérifiant si l'objet de réponse est une référence `$ref`. */
function isReference(value: ResponseObject | ReferenceObject): value is ReferenceObject {
  return '$ref' in value;
}

/**
 * Détermine si une opération REST retourne un résultat paginé en analysant son résumé, sa description et ses paramètres de requête.
 */
function isPaginated(operation: OperationObject, response: ResponseObject): boolean {
  const text = `${operation.summary ?? ''} ${operation.description ?? ''} ${response.description}`.toLowerCase();
  const queryNames = (operation.parameters ?? [])
    .filter((parameter): parameter is Exclude<typeof parameter, ReferenceObject> => !('$ref' in parameter))
    .filter((parameter) => parameter.in === 'query')
    .map((parameter) => parameter.name);
  return text.includes('pagin') || (queryNames.includes('page') && queryNames.includes('limit'));
}

/**
 * Génère le schéma de référence Swagger approprié pour une réponse de succès (Paginated, Collection ou Single).
 */
function successSchema(operation: OperationObject, response: ResponseObject): SchemaObject | ReferenceObject {
  const text = `${operation.summary ?? ''} ${response.description}`.toLowerCase();
  const schemaName = isPaginated(operation, response)
    ? 'ApiPaginatedResponse'
    : text.includes('liste')
      ? 'ApiCollectionResponse'
      : 'ApiSuccessResponse';
  return { $ref: `#/components/schemas/${schemaName}` };
}

/**
 * S'assure que le contenu et le type MIME de la réponse pour un statut donné sont correctement configurés dans Swagger.
 */
function ensureResponseSchema(path: string, operation: OperationObject, status: string): void {
  const candidate = operation.responses[status];
  if (!candidate || isReference(candidate) || status === '204') return;

  candidate.content ??= {};

  // Route de métriques Prometheus : format brut text/plain
  if (path.endsWith('/metrics')) {
    candidate.content['text/plain'] = { schema: { type: 'string' } };
    return;
  }

  // Fichiers binaires (téléchargement de rapports PDF ou pièces jointes)
  const isBinary = path.endsWith('/download') || candidate.description.toLowerCase().includes('fichier pdf');
  if (isBinary) {
    const mediaType = path.includes('/reports/') ? 'application/pdf' : 'application/octet-stream';
    candidate.content = { [mediaType]: { schema: { type: 'string', format: 'binary' } } };
    return;
  }

  // Réponses JSON de succès avec modèle DTO métier enveloppé
  const isSuccess = /^2\d\d$/.test(status);
  const responseModel = operation.operationId ? RELEASE_RESPONSE_MODELS[operation.operationId] : undefined;
  if (isSuccess && responseModel) {
    candidate.content['application/json'] = { schema: businessEnvelope(responseModel) };
    return;
  }
  if (Object.values(candidate.content).some((media) => media.schema)) return;

  // Schéma par défaut si aucun modèle spécifique n'est mappé
  candidate.content['application/json'] = {
    schema: isSuccess ? successSchema(operation, candidate) : { $ref: '#/components/schemas/ApiErrorResponse' },
  };
}

/**
 * Traite et complète une opération HTTP individuelle.
 */
function completeOperation(path: string, operation: OperationObject): void {
  for (const status of Object.keys(operation.responses)) {
    ensureResponseSchema(path, operation, status);
  }
  operation.responses.default ??= {
    description: 'Erreur standardisée.',
    content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } },
  };
}

/**
 * Fonction principale post-traitant l'ensemble du document OpenAPI pour injecter les schémas réutilisables et typer les routes.
 *
 * @param document Le document OpenAPI brut généré par SwaggerModule.
 * @returns Le document OpenAPI complété et prêt pour publication.
 */
export function completeOpenApiDocument(document: OpenAPIObject): OpenAPIObject {
  document.components ??= {};
  document.components.schemas = { ...document.components.schemas, ...OPENAPI_SCHEMAS };

  for (const [path, pathItem] of Object.entries(document.paths)) {
    for (const method of METHODS) {
      const operation = pathItem[method];
      if (operation) completeOperation(path, operation);
    }
  }
  for (const schema of Object.values(document.components.schemas)) normalizeBooleanEnums(schema);
  return document;
}

function normalizeBooleanEnums(value: unknown): void {
  if (!isRecord(value)) return;
  const values = value['enum'];
  if (Array.isArray(values) && values.length > 0 && values.every((item) => typeof item === 'boolean')) {
    value['type'] = 'boolean';
  }
  for (const nested of Object.values(value)) normalizeBooleanEnums(nested);
}
