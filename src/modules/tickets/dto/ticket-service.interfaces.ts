/**
 * ============================================================================
 * FICHIER : src/modules/tickets/dto/ticket-service.interfaces.ts
 * RÔLE : Interfaces TypeScript internes de saisie pour la couche service des tickets (`TicketsService`).
 * EXPLICATION :
 * Ce module définit les types stricts de paramètres passés aux méthodes internes de `TicketsService` :
 * 1. `CreateTicketInput` : Structure complète des attributs requis pour créer une instance de ticket en base.
 * 2. `UpdateTicketInput` : Ensemble des modifications partielles applicables à un ticket existant.
 * 3. Permet de découpler la couche applicative/domaine de la couche contrôleur HTTP (DTOs).
 * ============================================================================
 */

/**
 * Interface d'entrée pour la création d'un ticket au niveau de la couche service.
 */
export interface CreateTicketInput {
  /** Titre de l'incident. */
  title: string;
  /** Description détaillée de la panne ou du problème. */
  description: string;
  /** Niveau de priorité (LOW, MEDIUM, HIGH, CRITICAL). */
  priority: string;
  /** Niveau de sévérité télécom (S1, S2, S3, S4). */
  severity: string;
  /** Identifiant de la catégorie. */
  categoryId: string;
  /** Identifiant du département émetteur. */
  departmentId: string;
  /** Identifiant de l'équipe assignée. */
  assignedTeamId: string;
  /** Numéro de compte client (facultatif). */
  customerAccountNumber?: string;
  /** Nom du client (facultatif). */
  customerName?: string;
  /** Contact du client (facultatif). */
  customerContact?: string;
  /** Tags ou mots-clés (facultatif). */
  tags?: string;
}

/**
 * Interface d'entrée pour la mise à jour d'un ticket au niveau de la couche service.
 */
export interface UpdateTicketInput {
  /** Titre mis à jour (facultatif). */
  title?: string;
  /** Description mise à jour (facultatif). */
  description?: string;
  /** Priorité mise à jour (facultatif). */
  priority?: string;
  /** Sévérité mise à jour (facultatif). */
  severity?: string;
  /** Catégorie mise à jour (facultatif). */
  categoryId?: string;
  /** Tags mis à jour (facultatif). */
  tags?: string;
}
