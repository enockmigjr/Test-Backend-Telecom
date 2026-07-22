import { ReferenceObject, SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';

import { ResponseModel } from './response-model.map';

const success: SchemaObject = { type: 'boolean', enum: [true] };
const statusCode: SchemaObject = { type: 'integer', minimum: 200, maximum: 299 };

function reference(schema: string): ReferenceObject {
  return { $ref: `#/components/schemas/${schema}` };
}

export function businessEnvelope(model: ResponseModel): SchemaObject {
  const prewrapped = model.kind.startsWith('prewrapped');
  const required = prewrapped ? ['success'] : ['success', 'statusCode'];
  const properties: Record<string, SchemaObject | ReferenceObject> = { success };
  if (!prewrapped) properties.statusCode = statusCode;

  if (model.kind.endsWith('action')) {
    properties.message = { type: 'string' };
    return { type: 'object', required: [...required, 'message'], properties };
  }

  if (!model.schema) throw new Error(`Schéma métier absent pour la réponse ${model.kind}.`);
  if (model.kind === 'item') properties.data = reference(model.schema);
  if (model.kind.endsWith('array')) properties.data = { type: 'array', items: reference(model.schema) };
  if (model.kind === 'page') {
    properties.data = { type: 'array', items: reference(model.schema) };
    properties.meta = reference('PaginationMeta');
    required.push('meta');
  }
  required.push('data');
  properties.message = { type: 'string' };
  return { type: 'object', required, properties };
}
