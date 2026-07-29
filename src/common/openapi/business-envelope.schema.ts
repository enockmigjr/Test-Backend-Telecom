/**
 * ============================================================================
 * FICHIER : src/common/openapi/business-envelope.schema.ts
 * RÔLE : Générateur dynamique d'enveloppes OpenAPI Swagger pour les modèles DTO métier.
 * EXPLICATION :
 * Ce module construit le schéma Swagger d'enveloppement pour chaque type de réponse de l'API :
 * 1. `item` : Objet unique emballé dans `{ success: true, statusCode: 200, data: { ... } }`.
 * 2. `array` / `page` : Collection ou liste paginée avec métadonnées de pagination `meta`.
 * 3. `action` : Réponse de confirmation d'action avec message textuel `{ success: true, message: "..." }`.
 * ============================================================================
 */

import { ReferenceObject, SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';

import { ResponseModel } from './response-model.map';

/** Déclaration réutilisable du champ `success` (toujours `true` pour les réponses 2xx). */
const success: SchemaObject = { type: 'boolean', enum: [true] };

/** Déclaration réutilisable du statut HTTP numérique (200 à 299). */
const statusCode: SchemaObject = { type: 'integer', minimum: 200, maximum: 299 };

/**
 * Construit un objet de référence `$ref` vers un schéma Swagger existant dans les composants.
 *
 * @param schema Nom du schéma cible (ex: 'UserResponse').
 */
function reference(schema: string): ReferenceObject {
  return { $ref: `#/components/schemas/${schema}` };
}

/**
 * Construit le schéma d'enveloppe Swagger complet pour un modèle de réponse donné.
 *
 * @param model Description du type de modèle (item, page, array, action).
 * @returns Le `SchemaObject` OpenAPI formaté.
 */
export function businessEnvelope(model: ResponseModel): SchemaObject {
  const prewrapped = model.kind.startsWith('prewrapped');
  const required = prewrapped ? ['success'] : ['success', 'statusCode'];
  const properties: Record<string, SchemaObject | ReferenceObject> = { success };
  if (!prewrapped) properties.statusCode = statusCode;

  // Cas des réponses d'action simples (ex: { success: true, message: "Ticket supprimé" })
  if (model.kind.endsWith('action')) {
    properties.message = { type: 'string' };
    return { type: 'object', required: [...required, 'message'], properties };
  }

  if (!model.schema) throw new Error(`Schéma métier absent pour la réponse ${model.kind}.`);

  // Éléments individuels (ex: GET /tickets/:id)
  if (model.kind === 'item') properties.data = reference(model.schema);

  // Tableaux simples d'éléments (ex: GET /departments)
  if (model.kind.endsWith('array')) properties.data = { type: 'array', items: reference(model.schema) };

  // Réponses paginées avec méta-données (ex: GET /tickets avec pagination)
  if (model.kind === 'page') {
    properties.data = { type: 'array', items: reference(model.schema) };
    properties.meta = reference('PaginationMeta');
    required.push('meta');
  }
  required.push('data');
  properties.message = { type: 'string' };
  return { type: 'object', required, properties };
}
