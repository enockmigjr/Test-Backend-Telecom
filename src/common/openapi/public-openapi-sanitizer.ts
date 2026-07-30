import { OpenAPIObject } from '@nestjs/swagger';

type PathsObject = OpenAPIObject['paths'];
type PathItemObject = PathsObject[string];
type OperationObject = NonNullable<PathItemObject['get']>;
type ResponseValue = NonNullable<OperationObject['responses'][string]>;
type CallbacksObject = NonNullable<OperationObject['callbacks']>;
type CallbackValue = CallbacksObject[string];
type ConcreteResponse = Exclude<ResponseValue, { $ref: string }>;
type LinksObject = NonNullable<ConcreteResponse['links']>;
type LinkValue = LinksObject[string];
type ComponentsObject = NonNullable<OpenAPIObject['components']>;

function sanitizeLink(link: LinkValue): LinkValue {
  if ('$ref' in link) return link;
  return { ...link, server: undefined };
}

function sanitizeLinks(links: LinksObject | undefined): LinksObject | undefined {
  if (!links) return undefined;
  const sanitized: LinksObject = {};
  for (const [name, link] of Object.entries(links)) sanitized[name] = sanitizeLink(link);
  return sanitized;
}

function sanitizeDefinedResponse(response: ResponseValue): ResponseValue {
  if ('$ref' in response) return response;
  return { ...response, links: sanitizeLinks(response.links) };
}

function sanitizeResponse(response: ResponseValue | undefined): ResponseValue | undefined {
  return response ? sanitizeDefinedResponse(response) : undefined;
}

function sanitizeResponses(responses: OperationObject['responses']): OperationObject['responses'] {
  const sanitized: OperationObject['responses'] = {};
  for (const [status, response] of Object.entries(responses)) sanitized[status] = sanitizeResponse(response);
  return sanitized;
}

function sanitizeCallback(callback: CallbackValue): CallbackValue {
  if ('$ref' in callback) return callback;
  const sanitized: CallbackValue = {};
  for (const [expression, path] of Object.entries(callback)) sanitized[expression] = sanitizePath(path);
  return sanitized;
}

function sanitizeCallbacks(callbacks: CallbacksObject | undefined): CallbacksObject | undefined {
  if (!callbacks) return undefined;
  const sanitized: CallbacksObject = {};
  for (const [name, callback] of Object.entries(callbacks)) sanitized[name] = sanitizeCallback(callback);
  return sanitized;
}

export function sanitizeOperation(operation: OperationObject): OperationObject {
  return {
    ...operation,
    servers: undefined,
    responses: sanitizeResponses(operation.responses),
    callbacks: sanitizeCallbacks(operation.callbacks),
  };
}

function sanitizePath(path: PathItemObject): PathItemObject {
  return {
    ...path,
    servers: undefined,
    get: path.get ? sanitizeOperation(path.get) : undefined,
    put: path.put ? sanitizeOperation(path.put) : undefined,
    post: path.post ? sanitizeOperation(path.post) : undefined,
    delete: path.delete ? sanitizeOperation(path.delete) : undefined,
    options: path.options ? sanitizeOperation(path.options) : undefined,
    head: path.head ? sanitizeOperation(path.head) : undefined,
    patch: path.patch ? sanitizeOperation(path.patch) : undefined,
    trace: path.trace ? sanitizeOperation(path.trace) : undefined,
  };
}

function sanitizeComponentResponses(responses: ComponentsObject['responses']): ComponentsObject['responses'] {
  if (!responses) return undefined;
  const sanitized: NonNullable<ComponentsObject['responses']> = {};
  for (const [name, response] of Object.entries(responses)) sanitized[name] = sanitizeDefinedResponse(response);
  return sanitized;
}

function sanitizeComponentCallbacks(callbacks: ComponentsObject['callbacks']): ComponentsObject['callbacks'] {
  if (!callbacks) return undefined;
  const sanitized: NonNullable<ComponentsObject['callbacks']> = {};
  for (const [name, callback] of Object.entries(callbacks)) sanitized[name] = sanitizeCallback(callback);
  return sanitized;
}

function sanitizeComponentLinks(links: ComponentsObject['links']): ComponentsObject['links'] {
  return sanitizeLinks(links);
}

export function sanitizeComponents(components: ComponentsObject): ComponentsObject {
  return {
    ...components,
    responses: sanitizeComponentResponses(components.responses),
    callbacks: sanitizeComponentCallbacks(components.callbacks),
    links: sanitizeComponentLinks(components.links),
  };
}
