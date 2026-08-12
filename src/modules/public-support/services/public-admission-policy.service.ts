import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { DrizzleProvider } from '../../../database/drizzle.provider';
import {
  categories,
  departments,
  externalRequesters,
  slaPolicies,
  supportIntegrations,
} from '../../../database/schemas';
import { PublicAdmissionResult, PublicRouteTarget, PublicTicketDraft } from '../interfaces/public-admission.interface';
import { stringArray } from '../../../common/utils/helpers';

type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
type Severity = 'S1' | 'S2' | 'S3' | 'S4';

@Injectable()
export class PublicAdmissionPolicyService {
  constructor(private readonly drizzle: DrizzleProvider) {}

  async catalog(integrationId: string) {
    const policy = await this.loadPolicy(integrationId);
    const ids = stringArray(policy['allowedCategoryIds']);
    if (ids.length === 0) throw unavailable();
    const data = await this.drizzle.db
      .select({ id: categories.id, name: categories.name, description: categories.description })
      .from(categories)
      .where(inArray(categories.id, ids))
      .orderBy(categories.name);
    return { data: { categories: data, services: serviceCatalog(policy['services']) } };
  }

  async admit(integrationId: string, requesterId: string, draft: PublicTicketDraft): Promise<PublicAdmissionResult> {
    const policy = await this.loadPolicy(integrationId);
    const allowedCategoryIds = stringArray(policy['allowedCategoryIds']);
    if (!allowedCategoryIds.includes(draft.categoryId)) throw new BadRequestException('Catégorie non disponible.');

    const categoryRoutes = record(policy['categoryRoutes']);
    const serviceRoutes = record(policy['serviceRoutes']);
    const categoryRoute = routeTarget(categoryRoutes[draft.categoryId]);
    const serviceRoute = draft.serviceKey ? routeTarget(serviceRoutes[draft.serviceKey]) : undefined;
    const fallback = routeTarget(policy['defaultRoute']);
    const route = categoryRoute ?? serviceRoute ?? fallback;
    if (!route) throw unavailable();

    const matrix = record(policy['impactUrgencyMatrix']);
    const rating = ratingTarget(matrix[`${draft.impact}:${draft.urgency}`]);
    const priority = rating?.priority ?? route.priority;
    const severity = rating?.severity ?? route.severity;
    if (!priority || !severity) throw unavailable();

    const [category, department, team, requester, sla] = await Promise.all([
      this.drizzle.db
        .select({ id: categories.id })
        .from(categories)
        .where(eq(categories.id, draft.categoryId))
        .limit(1),
      this.drizzle.db
        .select({ id: departments.id })
        .from(departments)
        .where(and(eq(departments.id, route.departmentId), isNull(departments.deletedAt)))
        .limit(1),
      this.drizzle.db
        .select({ id: departments.id })
        .from(departments)
        .where(and(eq(departments.id, route.assignedTeamId), isNull(departments.deletedAt)))
        .limit(1),
      this.drizzle.db
        .select({ displayName: externalRequesters.displayName })
        .from(externalRequesters)
        .where(and(eq(externalRequesters.id, requesterId), eq(externalRequesters.supportIntegrationId, integrationId)))
        .limit(1),
      this.drizzle.db
        .select({ id: slaPolicies.id })
        .from(slaPolicies)
        .where(and(eq(slaPolicies.categoryId, draft.categoryId), eq(slaPolicies.priority, priority)))
        .limit(1),
    ]);
    if (!category[0] || !department[0] || !team[0] || !requester[0] || !sla[0]) throw unavailable();

    return {
      routeSource: categoryRoute ? 'CATEGORY' : serviceRoute ? 'SERVICE' : 'DEFAULT_TRIAGE',
      input: {
        title: draft.title.trim(),
        description: draft.description.trim(),
        categoryId: draft.categoryId,
        priority,
        severity,
        departmentId: route.departmentId,
        assignedTeamId: route.assignedTeamId,
        customerAccountNumber: draft.customerAccountNumber?.trim(),
        customerName: requester[0].displayName ?? undefined,
      },
    };
  }

  private async loadPolicy(integrationId: string): Promise<Record<string, unknown>> {
    const [integration] = await this.drizzle.db
      .select({ routingPolicy: supportIntegrations.routingPolicy })
      .from(supportIntegrations)
      .where(and(eq(supportIntegrations.id, integrationId), eq(supportIntegrations.status, 'ACTIVE')))
      .limit(1);
    if (!integration) throw unavailable();
    return integration.routingPolicy;
  }
}

function routeTarget(value: unknown): PublicRouteTarget | undefined {
  const data = record(value);
  if (!isString(data['departmentId']) || !isString(data['assignedTeamId'])) return undefined;
  const priority = priorityValue(data['priority']);
  const severity = severityValue(data['severity']);
  return { departmentId: data['departmentId'], assignedTeamId: data['assignedTeamId'], priority, severity };
}

function ratingTarget(value: unknown): { priority: Priority; severity: Severity } | undefined {
  const data = record(value);
  const priority = priorityValue(data['priority']);
  const severity = severityValue(data['severity']);
  return priority && severity ? { priority, severity } : undefined;
}

function priorityValue(value: unknown): Priority | undefined {
  return isOneOf(value, ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const);
}

function severityValue(value: unknown): Severity | undefined {
  return isOneOf(value, ['S1', 'S2', 'S3', 'S4'] as const);
}

function isOneOf<const T extends readonly string[]>(value: unknown, values: T): T[number] | undefined {
  return typeof value === 'string' && values.includes(value) ? (value as T[number]) : undefined;
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function isString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function serviceCatalog(value: unknown): Array<{ key: string; label: string }> {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const data = record(item);
    return isString(data['key']) && isString(data['label']) ? [{ key: data['key'], label: data['label'] }] : [];
  });
}

function unavailable(): ServiceUnavailableException {
  return new ServiceUnavailableException('Le support public est momentanément indisponible.');
}
