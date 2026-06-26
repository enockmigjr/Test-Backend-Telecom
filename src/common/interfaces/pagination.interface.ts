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
