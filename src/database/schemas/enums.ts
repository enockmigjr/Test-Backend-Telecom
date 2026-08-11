/**
 * ============================================================================
 * FICHIER : src/database/schemas/enums.ts
 * RÔLE : Définition des types énumérés (ENUMs) PostgreSQL.
 * EXPLICATION :
 * Les ENUMs sont des "listes de choix fermées" au niveau de la base de données.
 * Elles permettent d'interdire la saisie de valeurs incorrectes ou non reconnues
 * (ex: un statut de ticket inexistant, un rôle utilisateur inconnu, etc.).
 * ============================================================================
 */

import { pgEnum } from 'drizzle-orm/pg-core';

/**
 * 1. Rôles des utilisateurs de la plateforme (7 rôles distincts définissant les accès et permissions) :
 * - ADMINISTRATOR : Administrateur système global.
 * - SUPERVISOR : Supérieur hiérarchique / chef d'équipe.
 * - CUSTOMER_SERVICE_AGENT : Agent du service client (réception d'appels/tickets).
 * - NOC_ENGINEER : Ingénieur du Network Operations Center (incidents réseau).
 * - BILLING_AGENT : Agent de facturation.
 * - TECHNICAL_SUPPORT_ENGINEER : Ingénieur support technique niveau 2.
 * - FIELD_TECHNICIAN : Technicien d'intervention sur le terrain (niveau 3).
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
 * 2. Statuts possibles d'un ticket d'incident (cycle de vie de 9 états) :
 * - NEW : Ticket venant d'être créé.
 * - ASSIGNED : Ticket attribué à un agent/technicien.
 * - IN_PROGRESS : Traitement du ticket en cours.
 * - PENDING_CUSTOMER : En attente d'une information du client.
 * - PENDING_THIRD_PARTY : En attente d'un fournisseur ou partenaire externe.
 * - RESOLVED : Problème résolu par l'équipe technique.
 * - CLOSED : Ticket clôturé définitivement (automatiquement 48h après résolution ou manuellement).
 * - REOPENED : Ticket réouvert par un superviseur/admin.
 * - CANCELLED : Ticket annulé (doublon ou erreur).
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
 * 3. Niveaux de priorité des tickets (du moins urgent au plus critique) :
 * - LOW : Faible impact, traitement normal.
 * - MEDIUM : Impact modéré.
 * - HIGH : Forte urgence.
 * - CRITICAL : Urgence maximale (panne majeure d'infrastructure).
 */
export const ticketPriorityEnum = pgEnum('ticket_priority_enum', ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);

/**
 * 4. Niveaux de sévérité des tickets telecom (S1 à S4) :
 * - S1 : Panne totale de service.
 * - S2 : Degradation majeure.
 * - S3 : Degradation mineure.
 * - S4 : Demande d'information / tâche courante.
 */
export const ticketSeverityEnum = pgEnum('ticket_severity_enum', ['S1', 'S2', 'S3', 'S4']);

/**
 * 5. Catégories de tickets d'incidents télécom :
 * - NETWORK : Équipements et liaisons réseau.
 * - BILLING : Erreurs ou questions de facturation.
 * - TECHNICAL : Support technique applicatif.
 * - HARDWARE : Matériels et serveurs physiques.
 * - SOFTWARE : Logiciels et applications.
 * - OTHER : Divers.
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
 * 6. Types de notifications système envoyées aux utilisateurs (WebSockets / Email).
 */
export const notificationTypeEnum = pgEnum('notification_type_enum', [
  'TICKET_ASSIGNED',
  'TICKET_ESCALATED',
  'TICKET_RESOLVED',
  'COMMENT_ADDED',
  'SLA_WARNING',
  'SLA_BREACHED',
  'REPORT_READY',
  'REPORT_FAILED',
]);

/** Nature de l'acteur persistant une mutation métier. */
export const actorTypeEnum = pgEnum('actor_type_enum', ['INTERNAL', 'EXTERNAL_REQUESTER', 'SYSTEM']);

/** Canal ayant initié un échange de support. */
export const supportChannelEnum = pgEnum('support_channel_enum', [
  'INTERNAL',
  'WEB_PORTAL',
  'WIDGET',
  'WORDPRESS',
  'EMAIL',
  'WHATSAPP',
  'API',
]);

/** Statut d'un article de la base documentaire publique. */
export const knowledgeStatusEnum = pgEnum('knowledge_status_enum', ['DRAFT', 'PUBLISHED', 'ARCHIVED']);

export const integrationStatusEnum = pgEnum('integration_status_enum', ['DRAFT', 'ACTIVE', 'SUSPENDED']);
export const externalIdentityTypeEnum = pgEnum('external_identity_type_enum', ['EMAIL', 'PHONE', 'WORDPRESS']);
export const verificationChallengeStatusEnum = pgEnum('verification_challenge_status_enum', [
  'PENDING',
  'VERIFIED',
  'EXPIRED',
  'LOCKED',
]);
export const conversationStatusEnum = pgEnum('conversation_status_enum', [
  'OPEN',
  'TICKET_CREATED',
  'CLOSED',
  'ABANDONED',
]);
export const supportMessageDirectionEnum = pgEnum('support_message_direction_enum', ['INBOUND', 'OUTBOUND']);
export const outboxStatusEnum = pgEnum('outbox_status_enum', ['PENDING', 'PROCESSING', 'PUBLISHED', 'FAILED']);
export const deliveryStatusEnum = pgEnum('delivery_status_enum', [
  'PENDING',
  'PROCESSING',
  'DELIVERED',
  'FAILED',
  'DELIVERY_UNKNOWN',
]);
export const attachmentScanStatusEnum = pgEnum('attachment_scan_status_enum', [
  'NOT_REQUIRED',
  'QUARANTINED',
  'PENDING',
  'SCANNING',
  'CLEAN',
  'INFECTED',
  'ERROR',
]);
export const idempotencySubjectTypeEnum = pgEnum('idempotency_subject_type_enum', [
  'INTERNAL',
  'EXTERNAL_REQUESTER',
  'INTEGRATION',
]);
