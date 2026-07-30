import { OpenAPIObject } from '@nestjs/swagger';

import { PUBLIC_SUPPORT_AUDIENCE, PUBLIC_SUPPORT_AUDIENCE_EXTENSION } from './public-support-api.decorator';
import { sanitizeComponents, sanitizeOperation } from './public-openapi-sanitizer';

const METHODS = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'] as const;
const COMPONENT_SECTIONS = [
  'schemas',
  'responses',
  'parameters',
  'examples',
  'requestBodies',
  'headers',
  'securitySchemes',
  'links',
  'callbacks',
] as const;

type HttpMethod = (typeof METHODS)[number];
type ComponentSection = (typeof COMPONENT_SECTIONS)[number];
type ComponentReferences = { readonly [Section in ComponentSection]: Set<string> };
type PathsObject = OpenAPIObject['paths'];
type PathItemObject = PathsObject[string];
type OperationObject = NonNullable<PathItemObject['get']>;
type ComponentsObject = NonNullable<OpenAPIObject['components']>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPublicSupportOperation(operation: OperationObject | undefined): operation is OperationObject {
  const value: unknown = operation;
  return isRecord(value) && value[PUBLIC_SUPPORT_AUDIENCE_EXTENSION] === PUBLIC_SUPPORT_AUDIENCE;
}

function publicOperation(
  operation: OperationObject | undefined,
  route: string,
  method: HttpMethod,
): OperationObject | undefined {
  if (!isPublicSupportOperation(operation)) return undefined;
  if (!Array.isArray(operation.security)) {
    throw new Error(`Sécurité OpenAPI explicite requise pour ${method.toUpperCase()} ${route}.`);
  }
  return sanitizeOperation(operation);
}

function publicPath(route: string, path: PathItemObject): PathItemObject | null {
  const operations = {
    get: publicOperation(path.get, route, 'get'),
    put: publicOperation(path.put, route, 'put'),
    post: publicOperation(path.post, route, 'post'),
    delete: publicOperation(path.delete, route, 'delete'),
    options: publicOperation(path.options, route, 'options'),
    head: publicOperation(path.head, route, 'head'),
    patch: publicOperation(path.patch, route, 'patch'),
    trace: publicOperation(path.trace, route, 'trace'),
  } satisfies Pick<PathItemObject, HttpMethod>;

  if (!METHODS.some((method) => operations[method])) return null;
  return {
    summary: path.summary,
    description: path.description,
    parameters: path.parameters,
    ...operations,
  };
}

function publicPaths(paths: PathsObject): PathsObject {
  const selected: PathsObject = {};
  for (const [route, path] of Object.entries(paths)) {
    const projected = publicPath(route, path);
    if (projected) selected[route] = projected;
  }
  return selected;
}

function collectReferences(value: unknown, pending: Set<string>): void {
  if (Array.isArray(value)) {
    for (const item of value) collectReferences(item, pending);
    return;
  }
  if (!isRecord(value)) return;
  if (typeof value['$ref'] === 'string') pending.add(value['$ref']);
  for (const child of Object.values(value)) collectReferences(child, pending);
}

function emptyReferences(): ComponentReferences {
  return {
    schemas: new Set(),
    responses: new Set(),
    parameters: new Set(),
    examples: new Set(),
    requestBodies: new Set(),
    headers: new Set(),
    securitySchemes: new Set(),
    links: new Set(),
    callbacks: new Set(),
  };
}

function isComponentSection(value: string): value is ComponentSection {
  return COMPONENT_SECTIONS.some((section) => section === value);
}

function collectSecuritySchemes(value: unknown, pending: Set<string>): void {
  if (Array.isArray(value)) {
    for (const item of value) collectSecuritySchemes(item, pending);
    return;
  }
  if (!isRecord(value)) return;
  const security = value['security'];
  if (Array.isArray(security)) {
    for (const requirement of security) {
      if (!isRecord(requirement)) continue;
      for (const name of Object.keys(requirement)) pending.add(`#/components/securitySchemes/${name}`);
    }
  }
  for (const child of Object.values(value)) collectSecuritySchemes(child, pending);
}

function referencedComponents(document: OpenAPIObject, paths: PathsObject): ComponentReferences {
  const references = emptyReferences();
  const pending = new Set<string>();
  const visited = new Set<string>();
  collectReferences(paths, pending);
  collectSecuritySchemes(paths, pending);

  while (pending.size > 0) {
    const next = pending.values().next();
    if (next.done) break;
    const reference = next.value;
    pending.delete(reference);
    if (visited.has(reference)) continue;
    visited.add(reference);

    const match = reference.match(/^#\/components\/([^/]+)\/([^/]+)$/);
    if (!match) continue;
    const section = match[1];
    const name = match[2];
    if (!section || !isComponentSection(section) || !name) continue;
    references[section].add(name);
    const component = document.components?.[section]?.[name];
    collectReferences(component, pending);
    collectSecuritySchemes(component, pending);
  }
  return references;
}

function pickReferenced<T>(source: Record<string, T> | undefined, names: ReadonlySet<string>) {
  const entries = Object.entries(source ?? {}).filter(([name]) => names.has(name));
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

function publicComponents(document: OpenAPIObject, paths: PathsObject): ComponentsObject | undefined {
  const references = referencedComponents(document, paths);
  const components: ComponentsObject = {
    schemas: pickReferenced(document.components?.schemas, references.schemas),
    responses: pickReferenced(document.components?.responses, references.responses),
    parameters: pickReferenced(document.components?.parameters, references.parameters),
    examples: pickReferenced(document.components?.examples, references.examples),
    requestBodies: pickReferenced(document.components?.requestBodies, references.requestBodies),
    headers: pickReferenced(document.components?.headers, references.headers),
    securitySchemes: pickReferenced(document.components?.securitySchemes, references.securitySchemes),
    links: pickReferenced(document.components?.links, references.links),
    callbacks: pickReferenced(document.components?.callbacks, references.callbacks),
  };
  return Object.values(components).some(Boolean) ? sanitizeComponents(components) : undefined;
}

/** Produit le contrat minimal destiné au portail et aux adaptateurs publics. */
export function projectPublicOpenApi(document: OpenAPIObject): OpenAPIObject {
  const paths = publicPaths(document.paths);
  const tags = new Set(Object.values(paths).flatMap((path) => METHODS.flatMap((method) => path[method]?.tags ?? [])));
  const components = publicComponents(document, paths);

  return {
    openapi: document.openapi,
    info: {
      ...document.info,
      title: 'Telecom Public Support API',
      description: 'Contrat borné du portail public, du widget et des adaptateurs de support.',
    },
    paths,
    components,
    tags: document.tags?.filter((tag) => tags.has(tag.name)),
  };
}
