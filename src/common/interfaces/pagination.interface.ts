/**
 * ============================================================================
 * FICHIER : src/common/interfaces/pagination.interface.ts
 * RÔLE : Définitions de types, interfaces ou règles de domaine TypeScript.
 * EXPLICATION :
 * Ce fichier définit les structures de données, types stricts ou exceptions métier du domaine.
 * 1. Assure la cohérence des types à travers tout l'applicatif.
 * 2. Facilite l'auto-complétion et la détection d'erreurs à la compilation.
 * ============================================================================
 */

/**
 * Métadonnées de pagination standardisées.
 */
export interface PaginationMeta {
  /** Page courante (commence à 1) */
  page: number;
  /** Nombre d'éléments par page */
  limit: number;
  /** Nombre total d'éléments */
  total: number;
  /** Nombre total de pages */
  totalPages: number;
}

/**
 * Réponse paginée générique.
 */
export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

/**
 * Options de pagination standards.
 */
export interface PaginationOptions {
  page: number;
  limit: number;
  sort?: string;
  order?: 'asc' | 'desc';
}
