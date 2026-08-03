/**
 * ============================================================================
 * FICHIER : src/database/schemas/index.ts
 * RÔLE : Schéma de base de données PostgreSQL Drizzle ORM.
 * EXPLICATION :
 * Ce fichier décrit la structure d'une table PostgreSQL et ses contraintes.
 * 1. Définit les colonnes, types, clés primaires et relations.
 * 2. Assure un typage strict entre la base de données et le code TypeScript.
 * ============================================================================
 */

/** Réexportation des symboles pour l'importation centralisée. */
export * from './enums';
/** Réexportation des symboles pour l'importation centralisée. */
export * from './departments';
/** Réexportation des symboles pour l'importation centralisée. */
export * from './users';
/** Réexportation des symboles pour l'importation centralisée. */
export * from './categories';
/** Réexportation des symboles pour l'importation centralisée. */
export * from './sla-policies';
/** Réexportation des symboles pour l'importation centralisée. */
export * from './tickets';
export * from './ticket-relations';
/** Réexportation des symboles pour l'importation centralisée. */
export * from './ticket-assignments';
/** Réexportation des symboles pour l'importation centralisée. */
export * from './ticket-comments';
/** Réexportation des symboles pour l'importation centralisée. */
export * from './ticket-internal-notes';
/** Réexportation des symboles pour l'importation centralisée. */
export * from './attachments';
/** Réexportation des symboles pour l'importation centralisée. */
export * from './ticket-history';
/** Réexportation des symboles pour l'importation centralisée. */
export * from './refresh-tokens';
/** Réexportation des symboles pour l'importation centralisée. */
export * from './notifications';
/** Réexportation des symboles pour l'importation centralisée. */
export * from './audit-logs';
/** Réexportation des symboles pour l'importation centralisée. */
export * from './reports';
/** Réexportation des symboles pour l'importation centralisée. */
export * from './settings';
/** Réexportation des symboles pour l'importation centralisée. */
export * from './idempotency-records';
export * from './support-integrations';
export * from './integration-credentials';
export * from './external-requesters';
export * from './external-identities';
export * from './external-verification-challenges';
export * from './trusted-devices';
export * from './public-bootstrap-grants';
export * from './support-conversations';
export * from './support-messages';
export * from './outbox-events';
export * from './external-deliveries';
