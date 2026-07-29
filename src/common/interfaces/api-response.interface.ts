/**
 * ============================================================================
 * FICHIER : src/common/interfaces/api-response.interface.ts
 * RÔLE : Définitions de types, interfaces ou règles de domaine TypeScript.
 * EXPLICATION :
 * Ce fichier définit les structures de données, types stricts ou exceptions métier du domaine.
 * 1. Assure la cohérence des types à travers tout l'applicatif.
 * 2. Facilite l'auto-complétion et la détection d'erreurs à la compilation.
 * ============================================================================
 */

/**
 * Interface pour les réponses API standardisées.
 * Toutes les réponses HTTP suivent ce format.
 */
export interface ApiSuccessResponse<T = unknown> {
  success: true;
  message?: string;
  data: T;
}

export interface ApiErrorDetail {
  field?: string;
  message: string;
  code?: string;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: ApiErrorDetail[];
    correlationId: string;
    timestamp: string;
  };
}

export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;
