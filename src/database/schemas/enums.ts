import { pgEnum } from 'drizzle-orm/pg-core';

/**
 * Rôles des utilisateurs de la plateforme.
 */
export const roleEnum = pgEnum('role_enum', [
  'ADMINISTRATOR',
  'SUPERVISOR',
  'CUSTOMER_SERVICE_AGENT',
  'NOC_ENGINEER',
  'BILLING_AGENT',
  'TECHNICAL_SUPPORT_ENGINEER',
  'FIELD_TECHNICIAN',
]);

/**
 * Statuts possibles d'un ticket d'incident.
 */
export const ticketStatusEnum = pgEnum('ticket_status_enum', [
  'NEW',
  'ASSIGNED',
  'IN_PROGRESS',
  'PENDING_CUSTOMER',
  'PENDING_THIRD_PARTY',
  'RESOLVED',
  'CLOSED',
  'REOPENED',
  'CANCELLED',
]);

/**
 * Niveaux de priorité des tickets.
 */
export const ticketPriorityEnum = pgEnum('ticket_priority_enum', ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);

/**
 * Niveaux de sévérité des tickets.
 */
export const ticketSeverityEnum = pgEnum('ticket_severity_enum', ['S1', 'S2', 'S3', 'S4']);

/**
 * Catégories de tickets d'incidents.
 */
export const ticketCategoryEnum = pgEnum('ticket_category_enum', [
  'NETWORK',
  'BILLING',
  'TECHNICAL',
  'HARDWARE',
  'SOFTWARE',
  'OTHER',
]);

/**
 * Types de notifications.
 */
export const notificationTypeEnum = pgEnum('notification_type_enum', [
  'TICKET_ASSIGNED',
  'TICKET_ESCALATED',
  'TICKET_RESOLVED',
  'COMMENT_ADDED',
  'SLA_WARNING',
  'SLA_BREACHED',
  'REPORT_READY',
]);
