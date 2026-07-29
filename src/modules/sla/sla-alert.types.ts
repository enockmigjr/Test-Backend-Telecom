/**
 * ============================================================================
 * FICHIER : src/modules/sla/sla-alert.types.ts
 * RÔLE : Définitions de types, interfaces ou règles de domaine TypeScript.
 * EXPLICATION :
 * Ce fichier définit les structures de données, types stricts ou exceptions métier du domaine.
 * 1. Assure la cohérence des types à travers tout l'applicatif.
 * 2. Facilite l'auto-complétion et la détection d'erreurs à la compilation.
 * ============================================================================
 */

/** Définition de type `SlaTarget` pour le typage strict. */
export type SlaTarget = 'FIRST_RESPONSE' | 'RESOLUTION';

/** Définition de interface `SlaAlertTicket` pour le typage strict. */
export interface SlaAlertTicket {
  readonly id: string;
  readonly ticketNumber: string;
  readonly title: string;
  readonly priority: string;
  readonly status: string;
  readonly severity: string;
  readonly categoryName: string | null;
  readonly departmentName: string | null;
  readonly departmentId: string;
  readonly assignedTo: string | null;
  readonly dueAt: Date;
  readonly assigneeEmail: string | null;
  readonly assigneeFirstName: string | null;
  readonly assigneeLastName: string | null;
}
